package bridge

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

const writeOperationProgressEvent = "gui:write-operation-progress"

type writeOperation struct {
	id          string
	kind        string
	cancel      context.CancelFunc
	cancellable bool
}

type writeOperationManager struct {
	ctx     context.Context
	cancel  context.CancelFunc
	mu      sync.Mutex
	wg      sync.WaitGroup
	active  *writeOperation
	emitter func(string, any)
	closed  bool
}

func newWriteOperationManager(parent context.Context) *writeOperationManager {
	ctx, cancel := context.WithCancel(parent)
	return &writeOperationManager{
		ctx:    ctx,
		cancel: cancel,
	}
}

func (manager *writeOperationManager) setEmitter(emitter func(string, any)) {
	manager.mu.Lock()
	manager.emitter = emitter
	manager.mu.Unlock()
}

func (manager *writeOperationManager) begin(operationID, kind string) (context.Context, func(), error) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if manager.closed {
		return nil, nil, fmt.Errorf("应用正在关闭")
	}
	if manager.active != nil {
		return nil, nil, fmt.Errorf("已有写入操作正在运行")
	}
	ctx, cancel := context.WithCancel(manager.ctx)
	manager.active = &writeOperation{id: operationID, kind: kind, cancel: cancel, cancellable: true}
	manager.wg.Add(1)
	return ctx, func() {
		cancel()
		manager.mu.Lock()
		manager.active = nil
		manager.mu.Unlock()
		manager.wg.Done()
	}, nil
}

func (manager *writeOperationManager) cancelWriteOperation(operationID string) bool {
	manager.mu.Lock()
	item := manager.active
	if item == nil || item.id != operationID || !item.cancellable {
		manager.mu.Unlock()
		return false
	}
	item.cancel()
	manager.mu.Unlock()
	return true
}

func (manager *writeOperationManager) eventSink(operationID string) func(domain.ProgressEvent) error {
	return func(event domain.ProgressEvent) error {
		manager.progress(operationID, event)
		return nil
	}
}

func (manager *writeOperationManager) progress(operationID string, event domain.ProgressEvent) {
	manager.mu.Lock()
	item := manager.active
	if item == nil || item.id != operationID {
		manager.mu.Unlock()
		return
	}
	if item.kind == "workspace" &&
		(event.Stage == domain.StageRename || event.Stage == domain.StageComplete) {
		item.cancellable = false
	}
	progress := WriteOperationProgress{
		OperationID: operationID,
		Kind:        item.kind,
		Stage:       writeOperationStage(event.Stage),
		Current:     event.Current,
		Total:       event.Total,
		Message:     writeOperationMessage(event),
		MessageID:   writeOperationMessageID(event.Stage),
		Cancellable: item.cancellable,
	}
	if event.Path != "" {
		progress.Path = filepath.Base(event.Path)
	}
	emitter := manager.emitter
	manager.mu.Unlock()
	if emitter != nil {
		emitter(writeOperationProgressEvent, progress)
	}
}

func writeOperationMessageID(stage domain.EventStage) string {
	switch stage {
	case domain.StageScan:
		return ""
	case domain.StageSearch:
		return "search"
	case domain.StageFetch:
		return "fetch"
	case domain.StagePlan:
		return "plan"
	case domain.StageWrite:
		return "write"
	case domain.StageRename:
		return "rename"
	case domain.StageComplete:
		return "complete"
	default:
		return ""
	}
}

func writeOperationStage(stage domain.EventStage) string {
	switch stage {
	case domain.StageScan, domain.StageSearch, domain.StageFetch, domain.StagePlan:
		return "preparing"
	case domain.StageWrite:
		return "writing"
	case domain.StageRename:
		return "renaming"
	case domain.StageComplete:
		return "complete"
	default:
		return "preparing"
	}
}

func writeOperationMessage(event domain.ProgressEvent) string {
	switch event.Stage {
	case domain.StageScan:
		return event.Message
	case domain.StageSearch:
		return "正在搜索专辑"
	case domain.StageFetch:
		return "正在获取专辑元数据"
	case domain.StagePlan:
		return "正在准备写入内容"
	case domain.StageWrite:
		return fmt.Sprintf("正在写入 %d / %d", event.Current, event.Total)
	case domain.StageRename:
		return "正在重命名文件"
	case domain.StageComplete:
		return "写入完成"
	default:
		return event.Message
	}
}

func (manager *writeOperationManager) emitProgress(progress WriteOperationProgress) {
	manager.mu.Lock()
	item := manager.active
	if item == nil || item.id != progress.OperationID {
		manager.mu.Unlock()
		return
	}
	progress.Kind = item.kind
	progress.Cancellable = item.cancellable
	emitter := manager.emitter
	manager.mu.Unlock()
	if emitter != nil {
		emitter(writeOperationProgressEvent, progress)
	}
}

func (manager *writeOperationManager) close() {
	manager.mu.Lock()
	if manager.closed {
		manager.mu.Unlock()
		manager.wg.Wait()
		return
	}
	manager.closed = true
	manager.cancel()
	if manager.active != nil {
		manager.active.cancel()
	}
	manager.mu.Unlock()
	manager.wg.Wait()
	manager.mu.Lock()
	manager.emitter = nil
	manager.mu.Unlock()
}
