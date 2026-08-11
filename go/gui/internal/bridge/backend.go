package bridge

import (
	"context"
	"sync"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	wails "github.com/wailsapp/wails/v3/pkg/application"
)

type ServiceFactory func(domain.MetadataConfig, coreapp.EventSink) (*coreapp.Service, error)

type BackendOptions struct {
	Context          context.Context
	Config           domain.MetadataConfig
	Factory          ServiceFactory
	Sources          []SourceOption
	StartupDirectory string
}

type Backend struct {
	Workspace *WorkspaceService
	Batch     *BatchService
	Settings  *SettingsService

	runtime *runtimeState
	plans   *planStore
	ops     *operationManager
}

type runtimeState struct {
	mu       sync.RWMutex
	config   domain.MetadataConfig
	factory  ServiceFactory
	sources  []SourceOption
	warnings coreapp.WarningSink
}

func NewBackend(options BackendOptions) *Backend {
	ctx := options.Context
	if ctx == nil {
		ctx = context.Background()
	}
	operations := newOperationManager(ctx)
	runtime := &runtimeState{
		config:   options.Config,
		factory:  options.Factory,
		sources:  dtoSlice(options.Sources),
		warnings: operations.emitProcessError,
	}
	runtime.config.Source = searchableSourceOrDefault(runtime.config.Source, runtime.sources)
	plans := newPlanStore()
	workspace := &WorkspaceService{
		runtime:          runtime,
		plans:            plans,
		ops:              operations,
		startupDirectory: options.StartupDirectory,
	}
	batch := &BatchService{
		runtime:   runtime,
		workspace: workspace,
		ops:       operations,
		sessions:  make(map[string]*batchSession),
	}
	settings := &SettingsService{runtime: runtime}
	return &Backend{
		Workspace: workspace,
		Batch:     batch,
		Settings:  settings,
		runtime:   runtime,
		plans:     plans,
		ops:       operations,
	}
}

func (backend *Backend) Attach(app *wails.App, window *wails.WebviewWindow) {
	backend.ops.setEmitter(func(name string, value any) {
		app.Event.Emit(name, value)
	})
	backend.Workspace.app = app
	backend.Workspace.window = window
	backend.Batch.app = app
	backend.Batch.window = window
}

func (backend *Backend) Close() {
	backend.ops.close()
	backend.plans.clear()
}

func (runtime *runtimeState) service(events coreapp.EventSink) (*coreapp.Service, error) {
	runtime.mu.RLock()
	config := runtime.config
	factory := runtime.factory
	runtime.mu.RUnlock()
	service, err := factory(config, events)
	if err != nil {
		return nil, err
	}
	service.Warnings = runtime.warnings
	return service, nil
}

func (runtime *runtimeState) serviceWithConfig(
	config domain.MetadataConfig,
	events coreapp.EventSink,
) (*coreapp.Service, error) {
	service, err := runtime.factory(config, events)
	if err != nil {
		return nil, err
	}
	service.Warnings = runtime.warnings
	return service, nil
}

func (runtime *runtimeState) getConfig() domain.MetadataConfig {
	runtime.mu.RLock()
	defer runtime.mu.RUnlock()
	return cloneConfig(runtime.config)
}

func (runtime *runtimeState) setConfig(config domain.MetadataConfig) {
	runtime.mu.Lock()
	runtime.config = cloneConfig(config)
	runtime.mu.Unlock()
}

func (runtime *runtimeState) getSources() []SourceOption {
	runtime.mu.RLock()
	defer runtime.mu.RUnlock()
	return dtoSlice(runtime.sources)
}

func (runtime *runtimeState) searchableSource(value string) bool {
	runtime.mu.RLock()
	defer runtime.mu.RUnlock()
	for _, option := range runtime.sources {
		if option.Value == value {
			return option.SupportsSearch
		}
	}
	return false
}

func cloneConfig(value domain.MetadataConfig) domain.MetadataConfig {
	if value.Lyric != nil {
		lyric := *value.Lyric
		value.Lyric = &lyric
	}
	return value
}
