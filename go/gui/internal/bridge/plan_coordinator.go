package bridge

import (
	"context"
	"errors"
	"fmt"

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
	candidate, exists := service.catalog.get(owner, sourceName, candidateID)
	if album.Scan.MetadataPath != "" {
		candidate = candidateToDTO(domain.AlbumCandidate{
			ID: "local-json", Name: album.Name, Source: "local-json",
		}, album.Name)
		exists = true
	}
	if !exists {
		return nil, fmt.Errorf("专辑搜索结果已失效，请重新搜索")
	}
	data, err := applicationService.GetAlbumMetadata(ctx, album.Scan, dtoToCandidate(candidate))
	if err != nil {
		return nil, err
	}
	session := newPlanSession(ctx, album, applicationService, dtoToCandidate(candidate), data, defaultSource, owner)
	service.store.put(session)
	return session, nil
}

func (service *planCoordinator) updatePlan(
	ctx context.Context,
	patch PlanPatch,
) (PlanPreview, error) {
	session, exists := service.store.get(patch.PlanID)
	if !exists {
		return PlanPreview{}, fmt.Errorf("写入内容已失效，请重新准备")
	}
	return session.update(ctx, patch)
}

func (service *planCoordinator) executePlan(planID, operationID string) (WriteOperationResult, error) {
	ctx, finish, err := service.ops.begin(operationID, "workspace")
	if err != nil {
		return WriteOperationResult{}, err
	}
	defer finish()
	session, exists := service.store.get(planID)
	if !exists {
		return WriteOperationResult{}, &planInvalidatedError{err: fmt.Errorf("写入内容已失效，请重新准备")}
	}
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
		if !reusable {
			err = &planInvalidatedError{err: err}
		}
		return result, &planExecutionError{err: err, plan: result.Plan}
	}
	return result, nil
}
