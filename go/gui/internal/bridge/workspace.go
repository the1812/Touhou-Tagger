package bridge

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
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
	album, err := coreapp.OpenAlbum(ctx, directory, config.RuntimeAlbumOptions{Metadata: service.runtime.getConfig()})
	if err != nil {
		return WorkspaceSummary{}, err
	}
	if _, err := service.runtime.albumService(album, ""); err != nil {
		return WorkspaceSummary{}, err
	}
	scan := album.Scan
	effectiveSource := album.Options.Metadata.Source
	name := album.Name
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
	stored := service.runtime.getConfig()
	resolved, err := config.ResolveAlbum(directory, config.RuntimeAlbumOptions{Metadata: stored})
	if err != nil {
		return nil, err
	}
	applicationService, err := service.runtime.albumService(coreapp.Album{Options: resolved}, sourceName)
	if err != nil {
		return nil, err
	}
	return service.catalog.search(ctx, applicationService, "workspace", query, true)
}

func (service *WorkspaceService) PreparePlan(
	ctx context.Context,
	directory string,
	candidateID string,
	sourceName string,
) (PlanPreview, error) {
	session, err := service.planner.prepareOwnedPlan(ctx, directory, candidateID, sourceName, service.runtime.getConfig().Source, "workspace")
	if err != nil {
		return PlanPreview{}, err
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	return service.planner.previewLocked(session), nil
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
		ID:           candidate.ID,
		Title:        candidate.Name,
		Source:       candidate.Source,
		Artists:      dtoSlice(candidate.Artists),
		ThumbnailURL: candidate.ThumbnailURL,
		ExactMatch:   candidate.MatchesName(query),
		Description:  candidate.Description,
	}
}

func dtoToCandidate(candidate AlbumCandidate) domain.AlbumCandidate {
	return domain.AlbumCandidate{
		ID:           candidate.ID,
		Name:         candidate.Title,
		Source:       candidate.Source,
		Artists:      slices.Clone(candidate.Artists),
		ThumbnailURL: candidate.ThumbnailURL,
		Description:  candidate.Description,
	}
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
	code := "invalid-plan"
	var mismatch *domain.TrackCountMismatchError
	var conflict *domain.FileConflictError
	switch {
	case errors.As(err, &mismatch):
		code = "track-count-mismatch"
	case errors.As(err, &conflict):
		code = "target-exists"
		if conflict.OtherPath != "" {
			code = "target-conflict"
		}
	}
	return failureIssue(code, err)
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
