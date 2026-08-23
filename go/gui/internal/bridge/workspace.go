package bridge

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type WorkspaceService struct {
	runtime          *runtimeState
	planner          *planCoordinator
	catalog          *candidateCatalog
	desktop          *desktopService
	ops              *operationManager
	startupDirectory string
}

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

func (service *WorkspaceService) SelectAlbumDirectory(title string) (string, error) {
	return service.desktop.selectDirectory(title, albumDirectory)
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
	service.planner.discardOwner("workspace")
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
	return service.catalog.search(
		ctx,
		service.runtime,
		"workspace",
		directory,
		query,
		sourceName,
		true,
	)
}

func (service *WorkspaceService) PreparePlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
) (PlanPreview, error) {
	return service.planner.prepareOwnedPlan(ctx, directory, candidateID, sourceName, "workspace")
}

func (service *WorkspaceService) UpdatePlan(
	ctx context.Context,
	patch PlanPatch,
) (PlanPreview, error) {
	return service.planner.updatePlan(ctx, patch)
}

func (service *WorkspaceService) CommitPlan(
	planID string,
	revision int,
) (OperationStart, error) {
	return service.planner.commitPlan(planID, revision)
}

func (service *WorkspaceService) CancelOperation(operationID string) {
	service.ops.cancelOperation(operationID)
}

func (service *WorkspaceService) StartOperation(operationID string) error {
	return service.ops.release(operationID, "workspace")
}

func (service *WorkspaceService) DiscardPlan(planID string) bool {
	return service.planner.discard(planID)
}

func (service *WorkspaceService) RevealDirectory(ctx context.Context, directory string) error {
	return service.desktop.revealDirectory(ctx, directory)
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
