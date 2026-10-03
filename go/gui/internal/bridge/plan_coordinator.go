package bridge

import (
	"context"
	"errors"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type planCoordinator struct {
	runtime *runtimeState
	store   *planStore
	catalog *candidateCatalog
	ops     *writeOperationManager
}

func (coordinator *planCoordinator) discard(planID string) bool {
	return coordinator.store.discard(planID)
}

func (coordinator *planCoordinator) discardOwner(owner string) {
	coordinator.store.discardOwner(owner)
	coordinator.catalog.discardOwner(owner)
}

func (service *planCoordinator) prepareOwnedPlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
	defaultSource string,
	owner string,
) (*planSession, error) {
	base := service.runtime.getConfig()
	base.Source = defaultSource
	album, err := coreapp.OpenAlbum(ctx, directory, config.RuntimeAlbumOptions{Metadata: base})
	if err != nil {
		return nil, err
	}
	applicationService, err := service.runtime.albumService(album, sourceName)
	if err != nil {
		return nil, err
	}
	return service.prepareAlbumPlan(ctx, album, applicationService, candidateID, defaultSource, owner)
}

func (service *planCoordinator) prepareAlbumPlan(
	ctx context.Context,
	album coreapp.Album,
	applicationService *coreapp.Service,
	candidateID string,
	defaultSource string,
	owner string,
) (*planSession, error) {
	sourceName := applicationService.Config.Source
	candidate := service.catalog.get(owner, sourceName, candidateID)
	if album.Scan.MetadataPath != "" {
		candidate = candidateToDTO(domain.AlbumCandidate{
			ID: "local-json", Name: album.Name, Source: "local-json",
		}, album.Name)
	}
	data, err := applicationService.GetAlbumMetadata(ctx, album.Scan, dtoToCandidate(candidate))
	if err != nil {
		return nil, err
	}
	session := newPlanSession(ctx, album, applicationService, dtoToCandidate(candidate), data, defaultSource, owner)
	service.store.put(session)
	return session, nil
}

func (service *planCoordinator) executePlan(planID, operationID string) (WriteOperationResult, error) {
	ctx, finish, err := service.ops.begin(operationID, "workspace")
	if err != nil {
		return WriteOperationResult{}, err
	}
	defer finish()
	session := service.store.get(planID)
	result, reusable, err := session.execute(ctx, operationID, service.ops.eventSink(operationID))
	if !reusable {
		service.store.discard(planID)
	}
	if errors.Is(err, context.Canceled) && reusable {
		result.Cancelled = true
		result.Message = "操作已取消，未保存的临时文件已清理。"
		return result, nil
	}
	if err != nil {
		return result, &planExecutionError{err: err, plan: result.Plan}
	}
	return result, nil
}
