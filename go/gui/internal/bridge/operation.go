package bridge

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

const (
	operationProgressEvent = "gui:operation-progress"
	operationCompleteEvent = "gui:operation-complete"
	operationFailedEvent   = "gui:operation-failed"
	processErrorEvent      = "gui:process-error"
)

type operation struct {
	kind        string
	cancel      context.CancelFunc
	cancellable bool
	release     chan struct{}
	released    bool
}

type planInvalidatedError struct {
	err error
}

func (err *planInvalidatedError) Error() string {
	return "文件可能已发生变化，写入内容已失效，请重新扫描：" + err.err.Error()
}

func (err *planInvalidatedError) Unwrap() error {
	return err.err
}

type operationManager struct {
	ctx     context.Context
	cancel  context.CancelFunc
	mu      sync.Mutex
	wg      sync.WaitGroup
	items   map[string]*operation
	emitter func(string, any)
	closed  bool
}

func newOperationManager(parent context.Context) *operationManager {
	ctx, cancel := context.WithCancel(parent)
	return &operationManager{
		ctx:    ctx,
		cancel: cancel,
		items:  make(map[string]*operation),
	}
}

func (manager *operationManager) setEmitter(emitter func(string, any)) {
	manager.mu.Lock()
	manager.emitter = emitter
	manager.mu.Unlock()
}

func (manager *operationManager) start(
	kind string,
	run func(context.Context, string) (any, error),
) (OperationStart, error) {
	operationID := newID("operation")
	ctx, cancel := context.WithCancel(manager.ctx)
	manager.mu.Lock()
	if manager.closed {
		manager.mu.Unlock()
		cancel()
		return OperationStart{}, fmt.Errorf("应用正在关闭")
	}
	if len(manager.items) > 0 {
		manager.mu.Unlock()
		cancel()
		return OperationStart{}, fmt.Errorf("已有写入操作正在运行")
	}
	manager.items[operationID] = &operation{
		kind:        kind,
		cancel:      cancel,
		cancellable: true,
		release:     make(chan struct{}),
	}
	item := manager.items[operationID]
	manager.wg.Add(1)
	manager.mu.Unlock()
	go func() {
		defer manager.wg.Done()
		select {
		case <-item.release:
		case <-ctx.Done():
		}
		result, err := run(ctx, operationID)
		manager.finish(operationID, result, err)
	}()
	return OperationStart{OperationID: operationID}, nil
}

func (manager *operationManager) release(operationID string, kind string) error {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	item, exists := manager.items[operationID]
	if !exists || item.kind != kind {
		return fmt.Errorf("操作 %q 不存在", operationID)
	}
	if item.released {
		return fmt.Errorf("操作 %q 已开始", operationID)
	}
	item.released = true
	close(item.release)
	return nil
}

func (manager *operationManager) cancelOperation(operationID string) bool {
	manager.mu.Lock()
	item, exists := manager.items[operationID]
	if !exists || !item.cancellable {
		manager.mu.Unlock()
		return false
	}
	item.cancel()
	manager.mu.Unlock()
	return true
}

func (manager *operationManager) eventSink(operationID string) func(domain.ProgressEvent) error {
	return func(event domain.ProgressEvent) error {
		manager.progress(operationID, event)
		return nil
	}
}

func (manager *operationManager) progress(operationID string, event domain.ProgressEvent) {
	manager.mu.Lock()
	item, exists := manager.items[operationID]
	if !exists {
		manager.mu.Unlock()
		return
	}
	if item.kind == "workspace" &&
		(event.Stage == domain.StageCommit || event.Stage == domain.StageRename || event.Stage == domain.StageComplete) {
		item.cancellable = false
	}
	progress := OperationProgress{
		OperationID: operationID,
		Kind:        item.kind,
		Stage:       operationStage(event.Stage),
		Current:     event.Current,
		Total:       event.Total,
		Message:     operationMessage(event),
		Cancellable: item.cancellable,
	}
	if event.Path != "" {
		progress.Path = filepath.Base(event.Path)
	}
	emitter := manager.emitter
	manager.mu.Unlock()
	if emitter != nil {
		emitter(operationProgressEvent, progress)
	}
}

func operationStage(stage domain.EventStage) string {
	switch stage {
	case domain.StageScan, domain.StageSearch, domain.StageFetch, domain.StagePlan:
		return "preparing"
	case domain.StageWrite:
		return "writing"
	case domain.StageCommit:
		return "committing"
	case domain.StageRename:
		return "renaming"
	case domain.StageComplete:
		return "complete"
	default:
		return "preparing"
	}
}

func operationMessage(event domain.ProgressEvent) string {
	switch event.Stage {
	case domain.StageScan:
		return "正在重新验证专辑目录"
	case domain.StageSearch:
		return "正在搜索专辑"
	case domain.StageFetch:
		return "正在获取专辑元数据"
	case domain.StagePlan:
		return "正在准备写入内容"
	case domain.StageWrite:
		return fmt.Sprintf("正在写入 %d / %d", event.Current, event.Total)
	case domain.StageCommit:
		return "正在保存文件，暂时无法取消"
	case domain.StageRename:
		return "正在重命名文件"
	case domain.StageComplete:
		return "写入完成"
	default:
		return event.Message
	}
}

func (manager *operationManager) emitProgress(progress OperationProgress) {
	manager.mu.Lock()
	item, exists := manager.items[progress.OperationID]
	if !exists {
		manager.mu.Unlock()
		return
	}
	progress.Kind = item.kind
	progress.Cancellable = item.cancellable
	emitter := manager.emitter
	manager.mu.Unlock()
	if emitter != nil {
		emitter(operationProgressEvent, progress)
	}
}

func (manager *operationManager) emitProcessError(warning coreapp.ProcessWarning) error {
	manager.mu.Lock()
	emitter := manager.emitter
	manager.mu.Unlock()
	if emitter == nil {
		return fmt.Errorf("GUI event emitter is not attached")
	}
	emitter(processErrorEvent, ProcessError{
		Message: warning.Message,
		Details: warning.Details,
	})
	return nil
}

func (manager *operationManager) finish(operationID string, result any, err error) {
	manager.mu.Lock()
	item, exists := manager.items[operationID]
	if !exists {
		manager.mu.Unlock()
		return
	}
	delete(manager.items, operationID)
	item.cancel()
	emitter := manager.emitter
	manager.mu.Unlock()
	if emitter == nil {
		return
	}
	if err != nil {
		var invalidated *planInvalidatedError
		emitter(operationFailedEvent, OperationFailure{
			OperationID:     operationID,
			Kind:            item.kind,
			Message:         operationFailureMessage(err),
			Details:         err.Error(),
			PlanInvalidated: errors.As(err, &invalidated),
		})
		return
	}
	emitter(operationCompleteEvent, result)
}

func operationFailureMessage(err error) string {
	if errors.Is(err, context.Canceled) {
		return "操作已取消"
	}
	return "操作失败"
}

func (manager *operationManager) close() {
	manager.mu.Lock()
	if manager.closed {
		manager.mu.Unlock()
		manager.wg.Wait()
		return
	}
	manager.closed = true
	manager.cancel()
	for _, item := range manager.items {
		item.cancel()
	}
	manager.mu.Unlock()
	manager.wg.Wait()
	manager.mu.Lock()
	manager.items = make(map[string]*operation)
	manager.emitter = nil
	manager.mu.Unlock()
}
