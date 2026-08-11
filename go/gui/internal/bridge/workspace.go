package bridge

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	wails "github.com/wailsapp/wails/v3/pkg/application"
)

type WorkspaceService struct {
	runtime          *runtimeState
	plans            *planStore
	ops              *operationManager
	app              *wails.App
	window           *wails.WebviewWindow
	startupDirectory string

	mu                 sync.Mutex
	lastAlbumDirectory string
	lastBatchDirectory string
	candidates         map[string]AlbumCandidate
}

type directoryKind string

const (
	albumDirectory       directoryKind = "album"
	batchDirectory       directoryKind = "batch"
	dialogCancelledError               = "cancelled by user"
)

func (service *WorkspaceService) GetStartupDirectory() (string, error) {
	if service.startupDirectory == "" {
		return "", nil
	}
	info, err := os.Stat(service.startupDirectory)
	if err != nil {
		return "", fmt.Errorf("检查启动目录: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("启动目录 %q 不是文件夹", service.startupDirectory)
	}
	return service.startupDirectory, nil
}

func (service *WorkspaceService) SelectAlbumDirectory() (string, error) {
	return service.selectDirectory("选择专辑文件夹", albumDirectory)
}

func (service *WorkspaceService) ScanWorkspace(
	ctx context.Context,
	directory string,
) (WorkspaceSummary, error) {
	applicationService, err := service.runtime.service(nil)
	if err != nil {
		return WorkspaceSummary{}, err
	}
	scan, err := applicationService.ScanAlbum(ctx, directory)
	if err != nil {
		return WorkspaceSummary{}, err
	}
	storedConfig := service.runtime.getConfig()
	resolvedConfig, err := config.ResolveAlbum(
		scan.Directory,
		storedConfig,
		storedConfig.LyricEnabled,
	)
	if err != nil {
		return WorkspaceSummary{}, err
	}
	effectiveSource := resolvedConfig.Metadata.Source
	if scan.MetadataPath != "" {
		effectiveSource = "local-json"
	} else if !service.runtime.searchableSource(effectiveSource) {
		return WorkspaceSummary{}, fmt.Errorf("数据源 %q 不支持专辑搜索", effectiveSource)
	}
	name, err := coreapp.DefaultAlbumName(scan.Directory)
	if err != nil {
		return WorkspaceSummary{}, err
	}
	service.plans.discardOwner("workspace")
	summary := WorkspaceSummary{
		Directory:         scan.Directory,
		AudioCount:        len(scan.AudioFiles),
		LocalCover:        coverStatus(scan.CoverPath),
		HasMetadataJSON:   scan.MetadataPath != "",
		HasAlbumConfig:    fileExists(filepath.Join(scan.Directory, "thtag.json")),
		InferredAlbumName: name,
		EffectiveSource:   effectiveSource,
		Issues:            []StateIssue{},
	}
	for _, audio := range scan.AudioFiles {
		switch audio.Format {
		case domain.FormatMP3:
			summary.MP3Count++
		case domain.FormatFLAC:
			summary.FLACCount++
		}
	}
	if len(scan.AudioFiles) == 0 {
		summary.Issues = append(summary.Issues, errorIssue(
			"no-audio",
			"目录中没有支持的 MP3 或 FLAC 文件。",
		))
	}
	return summary, nil
}

func (service *WorkspaceService) SearchAlbums(
	ctx context.Context,
	directory string,
	query string,
	sourceName string,
) ([]AlbumCandidate, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, fmt.Errorf("专辑名称不能为空")
	}
	storedConfig := service.runtime.getConfig()
	resolvedConfig, err := config.ResolveAlbum(
		directory,
		storedConfig,
		storedConfig.LyricEnabled,
	)
	if err != nil {
		return nil, err
	}
	if sourceName != "" {
		resolvedConfig.Metadata.Source = sourceName
	}
	sourceName = resolvedConfig.Metadata.Source
	if !service.runtime.searchableSource(sourceName) {
		return nil, fmt.Errorf("数据源 %q 不支持专辑搜索", sourceName)
	}
	applicationService, err := service.runtime.serviceWithConfig(
		config.RuntimeMetadata(resolvedConfig.Metadata),
		nil,
	)
	if err != nil {
		return nil, err
	}
	candidates, err := applicationService.SearchAlbums(ctx, query, sourceName)
	if err != nil {
		return nil, err
	}
	result := make([]AlbumCandidate, len(candidates))
	service.mu.Lock()
	if service.candidates == nil {
		service.candidates = make(map[string]AlbumCandidate)
	}
	for index, candidate := range candidates {
		item := candidateToDTO(candidate, query)
		result[index] = item
		service.candidates[candidateKey(item.Source, item.ID)] = item
	}
	service.mu.Unlock()
	return result, nil
}

func (service *WorkspaceService) PreparePlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
) (PlanPreview, error) {
	return service.preparePlan(ctx, directory, candidateID, sourceName)
}

func (service *WorkspaceService) preparePlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
) (PlanPreview, error) {
	return service.prepareOwnedPlan(ctx, directory, candidateID, sourceName, "workspace")
}

func (service *WorkspaceService) prepareOwnedPlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
	owner string,
) (PlanPreview, error) {
	storedConfig := service.runtime.getConfig()
	resolvedConfig, err := config.ResolveAlbum(
		directory,
		storedConfig,
		storedConfig.LyricEnabled,
	)
	if err != nil {
		return PlanPreview{}, err
	}
	if sourceName != "" {
		resolvedConfig.Metadata.Source = sourceName
	}
	sourceName = resolvedConfig.Metadata.Source
	if sourceName != "local-json" && !service.runtime.searchableSource(sourceName) {
		return PlanPreview{}, fmt.Errorf("数据源 %q 不支持专辑搜索", sourceName)
	}
	runtimeConfig := config.RuntimeMetadata(resolvedConfig.Metadata)
	applicationService, err := service.runtime.serviceWithConfig(runtimeConfig, nil)
	if err != nil {
		return PlanPreview{}, err
	}
	initialScan, err := applicationService.ScanAlbum(ctx, directory)
	if err != nil {
		return PlanPreview{}, err
	}
	candidate, candidateExists := service.cachedCandidate(sourceName, candidateID)
	if initialScan.MetadataPath != "" {
		name, nameErr := coreapp.DefaultAlbumName(initialScan.Directory)
		if nameErr != nil {
			return PlanPreview{}, nameErr
		}
		candidate = AlbumCandidate{
			ID:          "local-json",
			Title:       name,
			Source:      "local-json",
			SourceLabel: sourceLabel("local-json"),
			Artists:     []string{},
			ExactMatch:  true,
		}
		candidateExists = true
	}
	if !candidateExists {
		return PlanPreview{}, fmt.Errorf("专辑候选已失效，请重新搜索")
	}
	data, localCover, err := applicationService.FetchTagData(ctx, initialScan.Directory, domain.AlbumCandidate{
		ID:     candidate.ID,
		Name:   candidate.Title,
		Source: candidate.Source,
	})
	if err != nil {
		return PlanPreview{}, err
	}
	cover := localCover
	coverSource := ""
	if len(localCover) > 0 {
		coverSource = "local"
	} else if len(data.Metadata) > 0 && len(data.Metadata[0].CoverImage) > 0 {
		cover = append([]byte(nil), data.Metadata[0].CoverImage...)
		coverSource = candidate.Source
	}
	snapshot, err := snapshotPlanInputs(data.Scan)
	if err != nil {
		return PlanPreview{}, err
	}
	session := &planSession{
		id:          newID("plan"),
		owner:       owner,
		revision:    1,
		scan:        data.Scan,
		metadata:    cloneMetadata(data.Metadata),
		candidate:   dtoToCandidate(candidate),
		cover:       cover,
		coverSource: coverSource,
		saveCover: data.Scan.CoverPath == "" &&
			len(cover) > 0 &&
			(resolvedConfig.Cover == nil || *resolvedConfig.Cover),
		config:   runtimeConfig,
		snapshot: snapshot,
	}
	service.rebuildSession(session)
	service.plans.put(session)
	return service.previewLocked(session), nil
}

func (service *WorkspaceService) UpdatePlan(
	_ context.Context,
	patch PlanPatch,
) (PlanPreview, error) {
	session, exists := service.plans.get(patch.PlanID)
	if !exists {
		return PlanPreview{}, fmt.Errorf("写入计划已失效，请重新生成预览")
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.committing {
		return PlanPreview{}, fmt.Errorf("写入计划正在提交，不能继续编辑")
	}
	if patch.Revision != session.revision {
		return PlanPreview{}, fmt.Errorf(
			"写入计划版本已变化：当前为 %d，提交的是 %d",
			session.revision,
			patch.Revision,
		)
	}
	for _, trackPatch := range patch.Tracks {
		_, valid := trackIndex(trackPatch.ID, len(session.metadata))
		if !valid {
			return PlanPreview{}, fmt.Errorf("写入计划中不存在曲目 %q", trackPatch.ID)
		}
	}
	if patch.SaveCover != nil {
		canSaveCover := session.scan.CoverPath == "" && len(session.cover) > 0
		if *patch.SaveCover && !canSaveCover {
			return PlanPreview{}, fmt.Errorf("当前计划没有可另存的远程封面")
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

func (service *WorkspaceService) CommitPlan(
	planID string,
	revision int,
) (OperationStart, error) {
	session, exists := service.plans.get(planID)
	if !exists {
		return OperationStart{}, fmt.Errorf("写入计划已失效，请重新生成预览")
	}
	session.mu.Lock()
	if session.revision != revision {
		current := session.revision
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("写入计划版本已变化：当前为 %d", current)
	}
	if session.committing {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("写入计划正在提交")
	}
	if !canCommit(session) {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("写入计划仍有未解决的问题")
	}
	session.committing = true
	session.mu.Unlock()
	started, err := service.ops.start("workspace", func(ctx context.Context, operationID string) (any, error) {
		result, reusable, err := service.executeCommit(
			ctx,
			operationID,
			planID,
			service.ops.eventSink(operationID),
		)
		if err == nil || !reusable {
			service.plans.delete(planID)
		} else {
			session.mu.Lock()
			session.committing = false
			session.mu.Unlock()
		}
		if errors.Is(err, context.Canceled) {
			result.OperationID = operationID
			result.Kind = "workspace"
			result.Cancelled = true
			result.Message = "操作已取消，未提交的临时文件已清理。"
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

func (service *WorkspaceService) CancelOperation(operationID string) {
	service.ops.cancelOperation(operationID)
}

func (service *WorkspaceService) StartOperation(operationID string) error {
	return service.ops.release(operationID, "workspace")
}

func (service *WorkspaceService) DiscardPlan(planID string) bool {
	return service.plans.discard(planID)
}

func (service *WorkspaceService) RevealDirectory(_ context.Context, directory string) error {
	info, err := os.Stat(directory)
	if err != nil {
		return fmt.Errorf("打开目录 %q: %w", directory, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%q 不是目录", directory)
	}
	command := exec.Command("explorer.exe", directory)
	if err := command.Start(); err != nil {
		return fmt.Errorf("打开资源管理器: %w", err)
	}
	go command.Wait()
	return nil
}

func (service *WorkspaceService) executeCommit(
	ctx context.Context,
	operationID string,
	planID string,
	events coreapp.EventSink,
) (OperationResult, bool, error) {
	started := time.Now()
	session, exists := service.plans.get(planID)
	if !exists {
		return OperationResult{}, false, fmt.Errorf("写入计划已失效")
	}
	session.mu.Lock()
	configValue := cloneConfig(session.config)
	metadata := cloneMetadata(session.metadata)
	expectedSnapshot := clonePlanSnapshot(session.snapshot)
	candidate := session.candidate
	cover := append([]byte(nil), session.cover...)
	directory := session.scan.Directory
	saveCover := session.saveCover && session.scan.CoverPath == "" && len(cover) > 0
	session.mu.Unlock()

	applicationService, err := service.runtime.serviceWithConfig(
		configValue,
		withoutCompleteEvents(events),
	)
	if err != nil {
		return OperationResult{}, true, err
	}
	currentScan, err := applicationService.ScanAlbum(ctx, directory)
	if err != nil {
		return OperationResult{}, true, err
	}
	if err := validatePlanInputs(currentScan, expectedSnapshot); err != nil {
		return OperationResult{}, false, err
	}
	plan, err := coreapp.BuildTagPlan(currentScan, metadata)
	if err != nil {
		return OperationResult{}, false, fmt.Errorf("重新验证写入计划: %w", err)
	}
	if err := validatePlanOutputs(
		plan,
		configValue,
		directory,
		cover,
		saveCover,
		expectedSnapshot.Outputs,
	); err != nil {
		return OperationResult{}, false, err
	}
	renamed := 0
	for _, item := range plan.Items {
		if !equalPath(item.SourcePath, item.TargetPath) {
			renamed++
		}
	}
	if err := applicationService.ApplyTagPlan(ctx, plan); err != nil {
		reusable := !coreapp.TagFilesMayHaveChanged(err) && !coreapp.PlanOutputsChanged(err)
		return OperationResult{}, reusable, err
	}
	coversSaved := 0
	if saveCover {
		if _, err := coreapp.SaveCoverNew(directory, cover); err != nil {
			return OperationResult{}, false, err
		}
		coversSaved = 1
	}
	if candidate.Source != "local-json" {
		defaultName, err := coreapp.DefaultAlbumName(directory)
		if err != nil {
			return OperationResult{}, false, err
		}
		if candidate.Name != "" && candidate.Name != defaultName {
			if err := config.SaveDefaultAlbumHint(directory, candidate.Name); err != nil {
				return OperationResult{}, false, err
			}
		}
	}
	lrcFiles := 0
	if configValue.LyricEnabled &&
		configValue.Lyric != nil &&
		configValue.Lyric.Output == domain.LyricLRC {
		for _, item := range plan.Items {
			if item.Metadata.Lyric != "" {
				lrcFiles++
			}
		}
	}
	if events != nil {
		if err := events(domain.ProgressEvent{
			Stage:     domain.StageComplete,
			Directory: directory,
			Current:   len(plan.Items),
			Total:     len(plan.Items),
		}); err != nil {
			return OperationResult{}, false, fmt.Errorf("发送最终完成进度: %w", err)
		}
	}
	return OperationResult{
		OperationID: operationID,
		Kind:        "workspace",
		Succeeded:   len(plan.Items),
		Renamed:     renamed,
		CoversSaved: coversSaved,
		LRCFiles:    lrcFiles,
		DurationMS:  time.Since(started).Milliseconds(),
		Message:     fmt.Sprintf("已完成 %d 首曲目的写入。", len(plan.Items)),
	}, false, nil
}

func withoutCompleteEvents(events coreapp.EventSink) coreapp.EventSink {
	if events == nil {
		return nil
	}
	return func(event domain.ProgressEvent) error {
		if event.Stage == domain.StageComplete {
			return nil
		}
		return events(event)
	}
}

func (service *WorkspaceService) rebuildSession(session *planSession) {
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
	outputs, outputIssues := snapshotPlanOutputs(
		session.plan,
		session.config,
		session.scan.Directory,
		session.cover,
		session.saveCover,
	)
	session.snapshot.Outputs = outputs
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

func (service *WorkspaceService) previewLocked(session *planSession) PlanPreview {
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
			item.WillRename = !equalPath(planItem.SourcePath, planItem.TargetPath)
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
	lrcFiles := 0
	for _, item := range items {
		if item.WillRename {
			renamed++
		}
	}
	if session.config.LyricEnabled &&
		session.config.Lyric != nil &&
		session.config.Lyric.Output == domain.LyricLRC {
		for _, item := range session.metadata {
			if item.Lyric != "" {
				lrcFiles++
			}
		}
	}
	compressCover := session.config.CoverCompressSize > 0 &&
		float64(len(session.cover)) > session.config.CoverCompressSize*1024*1024
	canSaveCover := session.scan.CoverPath == "" && len(session.cover) > 0
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

func (service *WorkspaceService) coverPreview(session *planSession) CoverPreview {
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

func (service *WorkspaceService) cachedCandidate(
	sourceName string,
	candidateID string,
) (AlbumCandidate, bool) {
	service.mu.Lock()
	defer service.mu.Unlock()
	if candidate, exists := service.candidates[candidateKey(sourceName, candidateID)]; exists {
		return candidate, true
	}
	return AlbumCandidate{}, false
}

func (service *WorkspaceService) selectDirectory(title string, kind directoryKind) (string, error) {
	if service.app == nil {
		return "", fmt.Errorf("原生目录对话框尚未初始化")
	}
	service.mu.Lock()
	initial := service.lastAlbumDirectory
	if kind == batchDirectory {
		initial = service.lastBatchDirectory
	}
	service.mu.Unlock()
	dialog := service.app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle(title)
	if initial != "" && fileExists(initial) {
		dialog.SetDirectory(initial)
	}
	if service.window != nil {
		dialog.AttachToWindow(service.window)
	}
	selected, err := dialog.PromptForSingleSelection()
	if err != nil {
		if err.Error() == dialogCancelledError {
			return "", nil
		}
		return "", err
	}
	if selected == "" {
		return "", nil
	}
	absolute, err := filepath.Abs(selected)
	if err != nil {
		return "", fmt.Errorf("解析目录路径: %w", err)
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return "", fmt.Errorf("检查所选目录 %q: %w", absolute, err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("所选路径 %q 不是目录", absolute)
	}
	service.mu.Lock()
	if kind == batchDirectory {
		service.lastBatchDirectory = absolute
	} else {
		service.lastAlbumDirectory = absolute
	}
	service.mu.Unlock()
	return absolute, nil
}

func canCommit(session *planSession) bool {
	if len(session.plan.Items) == 0 || session.committing {
		return false
	}
	for _, issue := range session.issues {
		if issue.Severity == "error" {
			return false
		}
	}
	return true
}

func applyAlbumPatch(metadata []domain.Metadata, patch AlbumMetadataPatch) {
	for index := range metadata {
		item := &metadata[index]
		if patch.Title != nil {
			item.Album = *patch.Title
		}
		if patch.AlbumOrder != nil {
			item.AlbumOrder = *patch.AlbumOrder
		}
		if patch.Artists != nil {
			item.AlbumArtists = append([]string(nil), (*patch.Artists)...)
		}
		if patch.Year != nil {
			item.Year = *patch.Year
		}
		if patch.Genres != nil {
			item.Genres = append([]string(nil), (*patch.Genres)...)
		}
	}
}

func applyTrackPatch(metadata *domain.Metadata, patch TrackMetadataPatch) {
	if patch.DiscNumber != nil {
		metadata.DiscNumber = *patch.DiscNumber
	}
	if patch.TrackNumber != nil {
		metadata.TrackNumber = *patch.TrackNumber
	}
	if patch.Title != nil {
		metadata.Title = *patch.Title
	}
	if patch.Artists != nil {
		metadata.Artists = append([]string(nil), (*patch.Artists)...)
	}
	if patch.Comments != nil {
		metadata.Comments = *patch.Comments
	}
}

func snapshotPlanInputs(scan domain.AlbumScan) (planSnapshot, error) {
	audioFiles := make([]fileSnapshot, len(scan.AudioFiles))
	for index, audio := range scan.AudioFiles {
		snapshot, err := snapshotPath(audio.Path, false)
		if err != nil {
			return planSnapshot{}, fmt.Errorf("检查音频文件 %q: %w", audio.Path, err)
		}
		if !snapshot.Exists {
			return planSnapshot{}, fmt.Errorf("音频文件 %q 已不存在", audio.Path)
		}
		audioFiles[index] = snapshot
	}
	localCover, err := snapshotPath(scan.CoverPath, true)
	if err != nil {
		return planSnapshot{}, fmt.Errorf("检查本地封面 %q: %w", scan.CoverPath, err)
	}
	metadata, err := snapshotPath(scan.MetadataPath, true)
	if err != nil {
		return planSnapshot{}, fmt.Errorf("检查本地元数据 %q: %w", scan.MetadataPath, err)
	}
	albumConfig, err := snapshotPath(filepath.Join(scan.Directory, "thtag.json"), true)
	if err != nil {
		return planSnapshot{}, fmt.Errorf("检查专辑配置: %w", err)
	}
	return planSnapshot{
		AudioFiles:  audioFiles,
		LocalCover:  localCover,
		Metadata:    metadata,
		AlbumConfig: albumConfig,
	}, nil
}

func snapshotPlanOutputs(
	plan domain.TagPlan,
	configValue domain.MetadataConfig,
	directory string,
	cover []byte,
	saveCover bool,
) ([]outputSnapshot, []StateIssue) {
	outputs, err := plannedOutputs(plan, configValue, directory, cover, saveCover)
	if err != nil {
		return nil, []StateIssue{errorIssue(
			"cover-target-invalid",
			fmt.Sprintf("无法确定封面保存位置：%v", err),
		)}
	}
	issues := make([]StateIssue, 0)
	for _, conflict := range coreapp.InspectPlanOutputs(outputs) {
		if conflict.Kind != coreapp.OutputConflictDuplicate {
			continue
		}
		message := fmt.Sprintf(
			"副产物目标文件冲突：曲目 %d 与曲目 %d 都会写入 %q。",
			conflict.Other.ItemIndex+1,
			conflict.Output.ItemIndex+1,
			filepath.Base(conflict.Output.Path),
		)
		issues = append(
			issues,
			outputStateIssue(conflict.Output, "output-target-conflict", message),
			outputStateIssue(conflict.Other, "output-target-conflict", message),
		)
	}
	snapshots := make([]outputSnapshot, 0, len(outputs))
	for _, output := range outputs {
		snapshot, snapshotErr := snapshotPath(output.Path, true)
		if snapshotErr != nil {
			issues = append(issues, outputStateIssue(
				output,
				"output-target-inspection",
				fmt.Sprintf("无法检查目标文件 %q：%v", filepath.Base(output.Path), snapshotErr),
			))
		} else if snapshot.Exists {
			issues = append(issues, outputStateIssue(
				output,
				output.Kind+"-target-exists",
				fmt.Sprintf(
					"%s目标文件 %q 已存在；请移走后重新生成预览，避免覆盖。",
					outputLabel(output.Kind),
					filepath.Base(output.Path),
				),
			))
		}
		snapshots = append(snapshots, outputSnapshot{
			Kind:   output.Kind,
			ItemID: outputItemID(output),
			File:   snapshot,
		})
	}
	return snapshots, issues
}

func plannedOutputs(
	plan domain.TagPlan,
	configValue domain.MetadataConfig,
	directory string,
	cover []byte,
	saveCover bool,
) ([]coreapp.PlanOutput, error) {
	outputs := coreapp.TagPlanOutputs(plan, configValue)
	if !saveCover {
		return outputs, nil
	}
	path, err := coreapp.CoverPath(directory, cover)
	if err != nil {
		return nil, err
	}
	return append(outputs, coreapp.PlanOutput{
		Kind:      coreapp.OutputCover,
		Path:      path,
		ItemIndex: -1,
	}), nil
}

func validatePlanInputs(scan domain.AlbumScan, expected planSnapshot) error {
	if len(scan.AudioFiles) != len(expected.AudioFiles) {
		return fmt.Errorf("目录中的音频文件数量已变化，请重新扫描")
	}
	for index, audio := range scan.AudioFiles {
		snapshot := expected.AudioFiles[index]
		if !equalPath(audio.Path, snapshot.Path) {
			return fmt.Errorf("目录中的音频文件顺序或名称已变化，请重新扫描")
		}
		changed, err := snapshotChanged(snapshot)
		if err != nil {
			return fmt.Errorf("重新检查音频文件 %q: %w", audio.Path, err)
		}
		if changed {
			return fmt.Errorf("音频文件 %q 在预览后发生了变化，请重新扫描", filepath.Base(audio.Path))
		}
	}
	if err := validateSelectedInput("本地封面", scan.CoverPath, expected.LocalCover); err != nil {
		return err
	}
	if err := validateSelectedInput("本地元数据", scan.MetadataPath, expected.Metadata); err != nil {
		return err
	}
	changed, err := snapshotChanged(expected.AlbumConfig)
	if err != nil {
		return fmt.Errorf("重新检查专辑配置 thtag.json: %w", err)
	}
	if changed {
		return fmt.Errorf("专辑配置 thtag.json 在预览后出现、移除或发生变化，请重新生成预览")
	}
	return nil
}

func validatePlanOutputs(
	plan domain.TagPlan,
	configValue domain.MetadataConfig,
	directory string,
	cover []byte,
	saveCover bool,
	expected []outputSnapshot,
) error {
	outputs, err := plannedOutputs(plan, configValue, directory, cover, saveCover)
	if err != nil {
		return fmt.Errorf("重新确定副产物目标: %w", err)
	}
	if len(outputs) != len(expected) {
		return fmt.Errorf("写入计划的副产物目标已变化，请重新生成预览")
	}
	for index, output := range outputs {
		snapshot := expected[index]
		if output.Kind != snapshot.Kind ||
			outputItemID(output) != snapshot.ItemID ||
			!equalPath(output.Path, snapshot.File.Path) {
			return fmt.Errorf("写入计划的副产物目标已变化，请重新生成预览")
		}
		if snapshot.File.Exists {
			return fmt.Errorf(
				"%s目标文件 %q 在预览时已存在，请移走后重新生成预览",
				outputLabel(output.Kind),
				filepath.Base(output.Path),
			)
		}
		changed, snapshotErr := snapshotChanged(snapshot.File)
		if snapshotErr != nil {
			return fmt.Errorf("重新检查副产物目标 %q: %w", output.Path, snapshotErr)
		}
		if changed {
			return fmt.Errorf(
				"%s目标文件 %q 在预览后出现或发生变化，请重新生成预览",
				outputLabel(output.Kind),
				filepath.Base(output.Path),
			)
		}
	}
	if conflicts := coreapp.InspectPlanOutputs(outputs); len(conflicts) > 0 {
		conflict := conflicts[0]
		return fmt.Errorf(
			"%s目标文件 %q 发生冲突，请重新生成预览",
			outputLabel(conflict.Output.Kind),
			filepath.Base(conflict.Output.Path),
		)
	}
	return nil
}

func snapshotPath(path string, digest bool) (fileSnapshot, error) {
	snapshot := fileSnapshot{Path: path, HasDigest: digest}
	if path == "" {
		return snapshot, nil
	}
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return snapshot, nil
	}
	if err != nil {
		return fileSnapshot{}, err
	}
	snapshot.Exists = true
	snapshot.Size = info.Size()
	snapshot.ModifiedUnixNano = info.ModTime().UnixNano()
	if digest && info.Mode().IsRegular() {
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return fileSnapshot{}, readErr
		}
		current, statErr := os.Stat(path)
		if statErr != nil {
			return fileSnapshot{}, statErr
		}
		if current.Size() != snapshot.Size ||
			current.ModTime().UnixNano() != snapshot.ModifiedUnixNano {
			return fileSnapshot{}, fmt.Errorf("文件在生成快照时发生变化")
		}
		snapshot.Digest = sha256.Sum256(data)
	}
	return snapshot, nil
}

func snapshotChanged(expected fileSnapshot) (bool, error) {
	actual, err := snapshotPath(expected.Path, expected.HasDigest)
	if err != nil {
		return false, err
	}
	if actual.Exists != expected.Exists {
		return true, nil
	}
	if !actual.Exists {
		return false, nil
	}
	if actual.Size != expected.Size ||
		actual.ModifiedUnixNano != expected.ModifiedUnixNano {
		return true, nil
	}
	return expected.HasDigest && actual.Digest != expected.Digest, nil
}

func validateSelectedInput(label, currentPath string, expected fileSnapshot) error {
	if expected.Path == "" && currentPath == "" {
		return nil
	}
	if expected.Path == "" ||
		currentPath == "" ||
		!equalPath(currentPath, expected.Path) {
		return fmt.Errorf("%s在预览后出现、移除或更换，请重新生成预览", label)
	}
	changed, err := snapshotChanged(expected)
	if err != nil {
		return fmt.Errorf("重新检查%s %q: %w", label, expected.Path, err)
	}
	if changed {
		return fmt.Errorf("%s %q 在预览后发生变化，请重新生成预览", label, filepath.Base(expected.Path))
	}
	return nil
}

func clonePlanSnapshot(snapshot planSnapshot) planSnapshot {
	snapshot.AudioFiles = slices.Clone(snapshot.AudioFiles)
	snapshot.Outputs = slices.Clone(snapshot.Outputs)
	return snapshot
}

func outputStateIssue(output coreapp.PlanOutput, code, message string) StateIssue {
	if output.ItemIndex >= 0 {
		return itemError(code, message, trackID(output.ItemIndex))
	}
	return errorIssue(code, message)
}

func outputItemID(output coreapp.PlanOutput) string {
	if output.ItemIndex < 0 {
		return ""
	}
	return trackID(output.ItemIndex)
}

func outputLabel(kind string) string {
	if kind == coreapp.OutputCover {
		return "封面"
	}
	return "歌词"
}

func cloneMetadata(metadata []domain.Metadata) []domain.Metadata {
	result := make([]domain.Metadata, len(metadata))
	for index, item := range metadata {
		result[index] = item
		result[index].AlbumArtists = append([]string(nil), item.AlbumArtists...)
		result[index].Genres = append([]string(nil), item.Genres...)
		result[index].CoverImage = item.CoverImage
		result[index].Artists = append([]string(nil), item.Artists...)
		result[index].Composers = append([]string(nil), item.Composers...)
		result[index].Lyricists = append([]string(nil), item.Lyricists...)
		if item.ExtraData != nil {
			result[index].ExtraData = make(map[string]any, len(item.ExtraData))
			for key, value := range item.ExtraData {
				result[index].ExtraData[key] = value
			}
		}
	}
	return result
}

func candidateToDTO(candidate domain.AlbumCandidate, query string) AlbumCandidate {
	return AlbumCandidate{
		ID:          candidate.ID,
		Title:       candidate.Name,
		Source:      candidate.Source,
		SourceLabel: sourceLabel(candidate.Source),
		Artists:     []string{},
		ExactMatch:  strings.EqualFold(strings.TrimSpace(candidate.Name), strings.TrimSpace(query)),
	}
}

func dtoToCandidate(candidate AlbumCandidate) domain.AlbumCandidate {
	return domain.AlbumCandidate{
		ID:     candidate.ID,
		Name:   candidate.Title,
		Source: candidate.Source,
	}
}

func sourceLabel(sourceName string) string {
	switch sourceName {
	case "thb-wiki":
		return "THBWiki"
	case "doujin-meta":
		return "Doujin Meta"
	case "local-json":
		return "本地 metadata.json"
	default:
		return sourceName
	}
}

func coverSourceLabel(sourceName string) string {
	if sourceName == "local" {
		return "本地封面"
	}
	if sourceName == "" || sourceName == "none" {
		return "无封面"
	}
	return sourceLabel(sourceName) + " 封面"
}

func coverCompressionDescription(value domain.MetadataConfig, size int) string {
	if value.CoverCompressSize <= 0 {
		return "未启用封面压缩，将保留原始图片"
	}
	threshold := int64(value.CoverCompressSize * 1024 * 1024)
	if int64(size) <= threshold {
		return fmt.Sprintf("低于 %.0f KB 阈值，将保留原始图片", value.CoverCompressSize*1024)
	}
	if value.CoverCompressResolution > 0 {
		return fmt.Sprintf("写入时将压缩，最大边长 %d px", value.CoverCompressResolution)
	}
	return "写入时将压缩封面"
}

func coverStatus(path string) CoverStatus {
	if path == "" {
		return CoverStatus{Valid: true}
	}
	result := CoverStatus{
		Exists:   true,
		Valid:    true,
		FileName: filepath.Base(path),
	}
	data, err := os.ReadFile(path)
	if err == nil {
		_, _, err = decodeCover(data)
	}
	if err != nil {
		issue := errorIssue("invalid-cover", fmt.Sprintf("本地封面无法读取或解码：%v", err))
		result.Valid = false
		result.Issue = &issue
	}
	return result
}

func planBuildIssue(err error) StateIssue {
	message := err.Error()
	code := "invalid-plan"
	switch {
	case strings.Contains(message, "track count mismatch"):
		code = "track-count-mismatch"
	case strings.Contains(message, "target filename conflict"):
		code = "target-conflict"
	case strings.Contains(message, "target file already exists"):
		code = "target-exists"
	}
	return errorIssue(code, message)
}

func errorIssue(code, message string) StateIssue {
	return StateIssue{Code: code, Message: message, Severity: "error"}
}

func warningIssue(code, message string) StateIssue {
	return StateIssue{Code: code, Message: message, Severity: "warning"}
}

func itemError(code, message, itemID string) StateIssue {
	issue := errorIssue(code, message)
	issue.ItemID = itemID
	return issue
}

func itemWarning(code, message, itemID string) StateIssue {
	issue := warningIssue(code, message)
	issue.ItemID = itemID
	return issue
}

func trackID(index int) string {
	return fmt.Sprintf("track-%d", index+1)
}

func trackIndex(id string, count int) (int, bool) {
	for index := 0; index < count; index++ {
		if id == trackID(index) {
			return index, true
		}
	}
	return 0, false
}

func candidateKey(sourceName, id string) string {
	return sourceName + "\x00" + id
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func equalPath(left, right string) bool {
	leftAbsolute, leftErr := filepath.Abs(filepath.Clean(left))
	rightAbsolute, rightErr := filepath.Abs(filepath.Clean(right))
	if leftErr != nil || rightErr != nil {
		return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
	}
	return strings.EqualFold(leftAbsolute, rightAbsolute)
}
