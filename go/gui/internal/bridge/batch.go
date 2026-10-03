package bridge

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type BatchService struct {
	runtime   *runtimeState
	planner   *planCoordinator
	catalog   *candidateCatalog
	desktop   *desktopService
	ops       *writeOperationManager
	loadSlots chan struct{}

	mu       sync.RWMutex
	sessions map[string]*batchSession
}

func (service *BatchService) SelectBatchDirectory(title string) (string, error) {
	return service.desktop.selectDirectory(title, batchDirectory)
}

func (service *BatchService) ScanBatch(
	ctx context.Context,
	directory string,
	depth int,
	sourceName string,
) (BatchPreview, error) {
	if sourceName == "" {
		sourceName = service.runtime.getConfig().Source
	}
	applicationService, err := service.runtime.service(nil)
	if err != nil {
		return BatchPreview{}, err
	}
	entries, err := applicationService.ScanBatch(ctx, directory, depth)
	if err != nil {
		return BatchPreview{}, err
	}
	root, err := filepath.Abs(directory)
	if err != nil {
		return BatchPreview{}, fmt.Errorf("解析批量写入目录: %w", err)
	}
	session := &batchSession{
		id:      newID("batch"),
		root:    root,
		depth:   depth,
		entries: make([]*batchEntry, 0, len(entries)),
	}
	for _, discovered := range entries {
		session.entries = append(session.entries, newBatchEntry(discovered, sourceName, session.id, service.planner))
	}
	service.mu.Lock()
	for id, previous := range service.sessions {
		delete(service.sessions, id)
		service.planner.discardOwner(previous.id)
	}
	service.sessions[session.id] = session
	service.mu.Unlock()
	return session.preview(), nil
}

func (service *BatchService) LoadBatchEntry(ctx context.Context, batchID, entryID string) (BatchEntryPreview, error) {
	select {
	case service.loadSlots <- struct{}{}:
		defer func() { <-service.loadSlots }()
	case <-ctx.Done():
		return BatchEntryPreview{}, ctx.Err()
	}
	return service.updateEntry(ctx, batchID, entryID, func(ctx context.Context, entry *batchEntry) { entry.load(ctx) })
}

func (service *BatchService) ResolveBatchCandidate(ctx context.Context, batchID, entryID, candidateID string) (BatchEntryPreview, error) {
	return service.updateEntry(ctx, batchID, entryID, func(ctx context.Context, entry *batchEntry) {
		entry.resolveCandidate(ctx, candidateID)
	})
}

func (service *BatchService) updateEntry(ctx context.Context, batchID, entryID string, update func(context.Context, *batchEntry)) (BatchEntryPreview, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	service.mu.RUnlock()
	if !exists {
		return BatchEntryPreview{}, fmt.Errorf("批量任务已失效，请重新扫描目录")
	}
	entry := session.findEntry(entryID)
	if entry == nil {
		return BatchEntryPreview{}, fmt.Errorf("批量写入专辑 %q 不存在", entryID)
	}
	update(ctx, entry)
	service.mu.RLock()
	current := service.sessions[batchID]
	service.mu.RUnlock()
	if current != session {
		entry.discardPlan()
		service.catalog.discardOwner(session.id)
		return BatchEntryPreview{}, fmt.Errorf("专辑加载结果已失效，请重新扫描目录")
	}
	return entry.preview(session.root), nil
}

func (service *BatchService) ExecuteBatch(batchID string, failedOnly bool, operationID string) (BatchRunResult, error) {
	ctx, finish, err := service.ops.begin(operationID, "batch")
	if err != nil {
		return BatchRunResult{}, err
	}
	defer finish()
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	service.mu.RUnlock()
	if !exists {
		return BatchRunResult{}, fmt.Errorf("批量任务已失效，请重新扫描目录")
	}
	selected := session.selectEntries(failedOnly)
	if len(selected) == 0 {
		return BatchRunResult{}, fmt.Errorf("没有可以写入的专辑")
	}
	return service.executeBatch(ctx, operationID, session, selected)
}

func (service *BatchService) DiscardBatch(batchID string) {
	service.mu.Lock()
	session, exists := service.sessions[batchID]
	delete(service.sessions, batchID)
	service.mu.Unlock()
	if exists {
		service.planner.discardOwner(session.id)
	}
}

func (service *BatchService) CancelBatch(operationID string) {
	service.ops.cancelWriteOperation(operationID)
}

func (service *BatchService) executeBatch(
	ctx context.Context,
	operationID string,
	session *batchSession,
	selected []*batchEntry,
) (BatchRunResult, error) {
	started := time.Now()
	result := BatchRunResult{
		OperationID: operationID,
		Kind:        "batch",
	}
	for index, entry := range selected {
		select {
		case <-ctx.Done():
			session.cancelRemaining(selected[index:])
			result.Cancelled = true
			result.Message = "已完成当前安全阶段，并停止写入后续专辑。"
			result.DurationMS = time.Since(started).Milliseconds()
			result.Entries = session.entryPreviews()
			return result, nil
		default:
		}
		directory := entry.directory
		service.ops.emitProgress(WriteOperationProgress{
			OperationID: operationID,
			Stage:       "preparing",
			Current:     index,
			Total:       len(selected),
			Path:        filepath.Base(directory),
			Message:     fmt.Sprintf("正在处理专辑 %d / %d", index+1, len(selected)),
		})
		executionResult, executionErr := entry.execute(ctx, operationID,
			service.batchEventSink(operationID, index, len(selected), directory))
		if executionResult.Cancelled {
			session.cancelRemaining(selected[index+1:])
			result.Cancelled = true
			result.Message = "已完成当前安全阶段，并停止写入后续专辑。"
			result.DurationMS = time.Since(started).Milliseconds()
			result.Entries = session.entryPreviews()
			return result, nil
		}
		if executionErr != nil {
			result.Failed++
			service.emitBatchAlbumProgress(
				operationID,
				index+1,
				len(selected),
				directory,
				fmt.Sprintf("专辑 %d / %d 处理失败", index+1, len(selected)),
			)
			continue
		}
		result.Succeeded++
		result.Renamed += executionResult.Renamed
		result.CoversSaved += executionResult.CoversSaved
		result.LRCFiles += executionResult.LRCFiles
		service.emitBatchAlbumProgress(
			operationID,
			index+1,
			len(selected),
			directory,
			fmt.Sprintf("已完成专辑 %d / %d", index+1, len(selected)),
		)
	}
	result.DurationMS = time.Since(started).Milliseconds()
	result.Message = fmt.Sprintf(
		"批量写入完成：%d 个成功，%d 个失败。",
		result.Succeeded,
		result.Failed,
	)
	result.Entries = session.entryPreviews()
	return result, nil
}

func (service *BatchService) batchEventSink(
	operationID string,
	completed int,
	total int,
	directory string,
) func(domain.ProgressEvent) error {
	return func(event domain.ProgressEvent) error {
		if event.Stage == domain.StageComplete {
			return nil
		}
		message := writeOperationMessage(event)
		if event.Stage == domain.StageWrite && event.Path != "" {
			message += " · " + filepath.Base(event.Path)
		}
		service.ops.emitProgress(WriteOperationProgress{
			OperationID: operationID,
			Stage:       writeOperationStage(event.Stage),
			Current:     completed,
			Total:       total,
			Path:        filepath.Base(directory),
			Message: fmt.Sprintf(
				"专辑 %d / %d · %s",
				completed+1,
				total,
				message,
			),
		})
		return nil
	}
}

func (service *BatchService) emitBatchAlbumProgress(
	operationID string,
	current int,
	total int,
	directory string,
	message string,
) {
	service.ops.emitProgress(WriteOperationProgress{
		OperationID: operationID,
		Stage:       "writing",
		Current:     current,
		Total:       total,
		Path:        filepath.Base(directory),
		Message:     message,
	})
}
