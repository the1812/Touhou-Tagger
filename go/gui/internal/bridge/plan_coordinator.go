package bridge

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type planCoordinator struct {
	runtime *runtimeState
	store   *planStore
	catalog *candidateCatalog
	ops     *operationManager
}

func (coordinator *planCoordinator) discard(planID string) bool {
	return coordinator.store.discard(planID)
}

func (coordinator *planCoordinator) delete(planID string) {
	coordinator.store.delete(planID)
}

func (coordinator *planCoordinator) discardOwner(owner string) {
	coordinator.store.discardOwner(owner)
	coordinator.catalog.discardOwner(owner)
}

func (coordinator *planCoordinator) claim(session *planSession) bool {
	session.mu.Lock()
	defer session.mu.Unlock()
	if !canCommit(session) {
		return false
	}
	session.committing = true
	return true
}

func (service *planCoordinator) prepareOwnedPlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
	owner string,
) (*planSession, error) {
	album, err := coreapp.OpenAlbum(ctx, directory, service.runtime.getConfig())
	if err != nil {
		return nil, err
	}
	applicationService, err := service.runtime.albumService(album, sourceName)
	if err != nil {
		return nil, err
	}
	return service.prepareAlbumPlan(ctx, album, applicationService, candidateID, owner)
}

func (service *planCoordinator) prepareAlbumPlan(
	ctx context.Context,
	album coreapp.Album,
	applicationService *coreapp.Service,
	candidateID string,
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
	data, err := applicationService.FetchTagData(ctx, album.Scan, dtoToCandidate(candidate))
	if err != nil {
		return nil, err
	}
	session := &planSession{
		id:          newID("plan"),
		owner:       owner,
		revision:    1,
		albumName:   album.Name,
		scan:        album.Scan,
		metadata:    cloneMetadata(data.Metadata),
		candidate:   dtoToCandidate(candidate),
		cover:       data.Cover,
		coverSource: data.CoverSource,
		saveCover:   len(data.Cover) > 0 && album.Config.Cover != nil && *album.Config.Cover,
		config:      applicationService.Config,
	}
	service.rebuildSession(session)
	service.store.put(session)
	return session, nil
}

func (service *planCoordinator) updatePlan(
	_ context.Context,
	patch PlanPatch,
) (PlanPreview, error) {
	session, exists := service.store.get(patch.PlanID)
	if !exists {
		return PlanPreview{}, fmt.Errorf("写入内容已失效，请重新准备")
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.committing {
		return PlanPreview{}, fmt.Errorf("写入内容正在保存，不能继续编辑")
	}
	if patch.Revision != session.revision {
		return PlanPreview{}, fmt.Errorf(
			"写入内容版本已变化：当前为 %d，保存的是 %d",
			session.revision,
			patch.Revision,
		)
	}
	for _, trackPatch := range patch.Tracks {
		_, valid := trackIndex(trackPatch.ID, len(session.metadata))
		if !valid {
			return PlanPreview{}, fmt.Errorf("写入内容中不存在曲目 %q", trackPatch.ID)
		}
	}
	if patch.SaveCover != nil {
		canSaveCover := len(session.cover) > 0
		if *patch.SaveCover && !canSaveCover {
			return PlanPreview{}, fmt.Errorf("当前写入内容没有可保存的封面")
		}
		session.saveCover = *patch.SaveCover
	}
	metadata := cloneMetadata(session.metadata)
	if patch.Album != nil {
		applyAlbumPatch(metadata, *patch.Album)
	}
	for _, trackPatch := range patch.Tracks {
		index, _ := trackIndex(trackPatch.ID, len(metadata))
		applyTrackPatch(&metadata[index], trackPatch)
	}
	session.metadata = metadata
	session.revision++
	service.rebuildSession(session)
	return service.previewLocked(session), nil
}

func (service *planCoordinator) commitPlan(planID string, revision int) (OperationStart, error) {
	session, exists := service.store.get(planID)
	if !exists {
		return OperationStart{}, fmt.Errorf("写入内容已失效，请重新准备")
	}
	session.mu.Lock()
	if session.revision != revision {
		current := session.revision
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("写入内容版本已变化：当前为 %d", current)
	}
	if session.committing {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("写入内容正在保存")
	}
	if !canCommit(session) {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("写入内容仍有未解决的问题")
	}
	session.committing = true
	session.mu.Unlock()
	started, err := service.ops.start("workspace", func(ctx context.Context, operationID string) (any, error) {
		result, reusable, err := service.executeCommit(
			ctx,
			operationID,
			session,
			service.ops.eventSink(operationID),
		)
		if !reusable {
			service.store.delete(planID)
		}
		if errors.Is(err, context.Canceled) && reusable {
			result.OperationID = operationID
			result.Kind = "workspace"
			result.Cancelled = true
			result.Message = "操作已取消，未保存的临时文件已清理。"
			return result, nil
		}
		if err != nil && !reusable {
			return result, &planInvalidatedError{err: err}
		}
		return result, err
	})
	if err != nil {
		session.mu.Lock()
		session.committing = false
		session.mu.Unlock()
		return OperationStart{}, err
	}
	return started, nil
}

func (service *planCoordinator) executeCommit(
	ctx context.Context,
	operationID string,
	session *planSession,
	events coreapp.EventSink,
) (result OperationResult, reusable bool, err error) {
	started := time.Now()
	defer func() {
		session.mu.Lock()
		defer session.mu.Unlock()
		session.committing = false
		if reusable {
			session.revision++
			service.rebuildSession(session)
			if session.owner == "workspace" {
				preview := service.previewLocked(session)
				result.Plan = &preview
			}
		}
	}()
	session.mu.Lock()
	configValue := cloneConfig(session.config)
	metadata := cloneMetadata(session.metadata)
	commit := coreapp.AlbumCommit{Candidate: session.candidate, DefaultAlbumName: session.albumName}
	scan := session.scan
	commit.Cover, err = session.coverOutput()
	session.mu.Unlock()
	if err != nil {
		return OperationResult{}, true, err
	}
	applicationService, err := service.runtime.serviceWithConfig(configValue, events)
	if err != nil {
		return OperationResult{}, true, err
	}
	commit.Plan, err = coreapp.BuildTagPlan(scan, metadata)
	if err != nil {
		return OperationResult{}, true, fmt.Errorf("准备写入内容: %w", err)
	}
	applied, err := applicationService.CommitAlbum(ctx, commit)
	session.mu.Lock()
	if applied.AudioRenamed {
		for index, item := range commit.Plan.Items {
			session.scan.AudioFiles[index].Path = item.TargetPath
		}
	}
	if applied.CoverPath != "" {
		session.scan.CoverPath = applied.CoverPath
	}
	if err == nil && commit.Candidate.Source != "local-json" && commit.Candidate.Name != "" {
		session.albumName = commit.Candidate.Name
	}
	session.mu.Unlock()
	return OperationResult{
		OperationID: operationID,
		Kind:        "workspace",
		Succeeded:   applied.Written,
		Renamed:     applied.Renamed,
		CoversSaved: applied.CoversSaved,
		LRCFiles:    applied.LRCFiles,
		DurationMS:  time.Since(started).Milliseconds(),
		Message:     fmt.Sprintf("已完成 %d 首曲目的写入。", applied.Written),
	}, applied.Reusable, err
}

func (service *planCoordinator) rebuildSession(session *planSession) {
	session.issues = session.issues[:0]
	plan, err := coreapp.BuildTagPlan(session.scan, session.metadata)
	if err != nil {
		session.plan = domain.TagPlan{}
		session.issues = append(session.issues, planBuildIssue(err))
	} else {
		session.plan = plan
	}
	if len(session.cover) > 0 {
		if _, _, err := decodeCover(session.cover); err != nil {
			session.issues = append(session.issues, errorIssue(
				"invalid-cover",
				fmt.Sprintf("封面图片无法解码：%v", err),
			))
		}
	}
	outputIssues := inspectPlanOutputs(
		session.plan,
		session.config,
		session.scan.Directory,
		session.cover,
		session.saveCover,
		session.scan.CoverPath,
	)
	session.issues = append(session.issues, outputIssues...)
	for index, metadata := range session.metadata {
		itemID := trackID(index)
		if strings.TrimSpace(metadata.Title) == "" {
			session.issues = append(session.issues, itemError(
				"empty-title",
				"曲目标题不能为空。",
				itemID,
			))
		}
		if len(metadata.Artists) == 0 {
			session.issues = append(session.issues, itemWarning(
				"empty-artists",
				"数据源未提供曲目艺术家，将以空值继续写入。",
				itemID,
			))
		}
	}
}

func (service *planCoordinator) previewLocked(session *planSession) PlanPreview {
	metadataCount := len(session.metadata)
	audioCount := len(session.scan.AudioFiles)
	count := max(metadataCount, audioCount)
	items := make([]PlanItemPreview, 0, count)
	for index := 0; index < count; index++ {
		item := PlanItemPreview{
			ID:      trackID(index),
			Artists: []string{},
			Issues:  []StateIssue{},
		}
		if index < audioCount {
			audio := session.scan.AudioFiles[index]
			item.SourceName = filepath.Base(audio.Path)
			item.Format = strings.ToUpper(string(audio.Format))
		}
		if index < metadataCount {
			metadata := session.metadata[index]
			item.DiscNumber = metadata.DiscNumber
			item.TrackNumber = metadata.TrackNumber
			item.Title = metadata.Title
			item.Artists = dtoSlice(metadata.Artists)
			item.Comments = metadata.Comments
		}
		if index < len(session.plan.Items) {
			planItem := session.plan.Items[index]
			item.TargetName = filepath.Base(planItem.TargetPath)
			item.WillRename = planItem.SourcePath != planItem.TargetPath
		}
		for _, issue := range session.issues {
			if issue.ItemID == item.ID {
				item.Issues = append(item.Issues, issue)
			}
		}
		if index >= metadataCount || index >= audioCount {
			item.Issues = append(item.Issues, itemError(
				"track-count-mismatch",
				"本地文件与元数据曲目无法一一对应。",
				item.ID,
			))
		}
		items = append(items, item)
	}
	album := AlbumMetadata{Artists: []string{}, Genres: []string{}}
	if metadataCount > 0 {
		first := session.metadata[0]
		album = AlbumMetadata{
			Title:      first.Album,
			AlbumOrder: first.AlbumOrder,
			Artists:    dtoSlice(first.AlbumArtists),
			Year:       first.Year,
			Genres:     dtoSlice(first.Genres),
		}
	}
	cover := service.coverPreview(session)
	renamed := 0
	for _, item := range items {
		if item.WillRename {
			renamed++
		}
	}
	lrcFiles := len(coreapp.TagPlanOutputs(session.plan, session.config))
	compressCover := session.config.CoverCompressSize > 0 &&
		float64(len(session.cover)) > session.config.CoverCompressSize*1024*1024
	canSaveCover := len(session.cover) > 0
	issues := make([]StateIssue, 0, len(session.issues))
	for _, issue := range session.issues {
		if issue.ItemID == "" && issue.Code != "invalid-cover" {
			issues = append(issues, issue)
		}
	}
	return PlanPreview{
		PlanID:    session.id,
		Revision:  session.revision,
		Directory: session.scan.Directory,
		Album:     album,
		Candidate: candidateToDTO(session.candidate, session.candidate.Name),
		Cover:     cover,
		Items:     items,
		Issues:    issues,
		Options: PlanOptions{
			WriteFiles:    len(session.plan.Items),
			RenameFiles:   renamed,
			CanSaveCover:  canSaveCover,
			SaveCover:     canSaveCover && session.saveCover,
			CompressCover: compressCover,
			LRCFiles:      lrcFiles,
		},
		CanCommit: canCommit(session),
	}
}

func (service *planCoordinator) coverPreview(session *planSession) CoverPreview {
	if len(session.cover) == 0 {
		return CoverPreview{
			Source:                 "none",
			SourceLabel:            "无封面",
			CompressionDescription: "此专辑不会写入封面",
		}
	}
	width, height, err := decodeCover(session.cover)
	if err != nil {
		issue := errorIssue("invalid-cover", fmt.Sprintf("封面图片无法解码：%v", err))
		return CoverPreview{
			Source:                 session.coverSource,
			SourceLabel:            coverSourceLabel(session.coverSource),
			ByteSize:               len(session.cover),
			CompressionDescription: "封面无效，不会写入文件",
			Issue:                  &issue,
		}
	}
	return CoverPreview{
		URL:                    fmt.Sprintf("/gui/preview/%s/cover?revision=%d", session.id, session.revision),
		Source:                 session.coverSource,
		SourceLabel:            coverSourceLabel(session.coverSource),
		Width:                  width,
		Height:                 height,
		ByteSize:               len(session.cover),
		CompressionDescription: coverCompressionDescription(session.config, len(session.cover)),
	}
}
