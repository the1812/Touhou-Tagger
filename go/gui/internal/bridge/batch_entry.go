package bridge

import (
	"context"
	"errors"
	"path/filepath"
	"slices"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type batchEntry struct {
	planner             *planCoordinator
	owner               string
	searchSource        string
	id                  string
	directory           string
	inferredAlbumName   string
	source              string
	audioCount          int
	status              string
	issues              []StateIssue
	candidates          []AlbumCandidate
	selectedCandidateID string
	plan                *planSession
}

func newBatchEntry(scan domain.BatchScanEntry, source, owner string, planner *planCoordinator) *batchEntry {
	entry := &batchEntry{
		id: newID("entry"), directory: scan.Directory, inferredAlbumName: scan.Name,
		source: source, searchSource: source, owner: owner, planner: planner,
		audioCount: scan.AudioCount, status: "loading", issues: []StateIssue{}, candidates: []AlbumCandidate{},
	}
	if scan.Ignored {
		entry.status = "no-audio"
		entry.issues = []StateIssue{errorIssue("no-audio", "目录中没有支持的 MP3 或 FLAC 文件。")}
	} else if scan.PreflightErr != nil {
		entry.status = "scan-failed"
		entry.issues = []StateIssue{failureIssue("scan-failed", scan.PreflightErr)}
	}
	return entry
}

func (entry *batchEntry) load(ctx context.Context) {
	entry.update(func() error { return entry.loadAlbum(ctx) })
}

func (entry *batchEntry) resolveCandidate(ctx context.Context, candidateID string) {
	entry.update(func() error { return entry.chooseCandidate(ctx, candidateID) })
}

func (entry *batchEntry) update(load func() error) {
	entry.discardPlan()
	entry.issues = nil
	entry.status = "ready"
	if err := load(); err != nil {
		entry.status = "scan-failed"
		entry.issues = []StateIssue{failureIssue("load-failed", err)}
	}
}

func (entry *batchEntry) discardPlan() {
	if entry.plan != nil {
		entry.planner.discard(entry.plan.id)
		entry.plan = nil
	}
}

func (entry *batchEntry) canRun() bool {
	return entry.plan != nil && entry.plan.canExecute()
}

func (entry *batchEntry) queue(failedOnly bool) bool {
	if failedOnly && entry.status != "failed" {
		return false
	}
	if !entry.canRun() {
		return false
	}
	entry.status = "queued"
	return true
}

func (entry *batchEntry) cancel() {
	entry.status = "cancelled"
}

func (entry *batchEntry) execute(ctx context.Context, operationID string, events application.EventSink) (WriteOperationResult, error) {
	entry.status = "running"
	result, reusable, err := entry.plan.execute(ctx, operationID, events)
	if !reusable {
		entry.discardPlan()
	}
	if errors.Is(err, context.Canceled) && reusable {
		entry.status = "cancelled"
		result.Cancelled = true
		return result, nil
	}
	if err != nil {
		entry.status = "failed"
		entry.issues = []StateIssue{failureIssue("operation-failed", err)}
		return result, err
	}
	entry.status = "succeeded"
	entry.issues = []StateIssue{}
	return result, nil
}

func (entry *batchEntry) loadAlbum(ctx context.Context) error {
	base := entry.planner.runtime.getConfig()
	base.Source = entry.searchSource
	album, err := application.OpenAlbum(ctx, entry.directory, config.RuntimeAlbumOptions{Metadata: base})
	if err != nil {
		return err
	}
	entry.inferredAlbumName = album.Name
	entry.audioCount = len(album.Scan.AudioFiles)
	entry.source = album.Options.Metadata.Source
	entry.candidates = nil
	entry.selectedCandidateID = ""
	if entry.audioCount == 0 {
		entry.status = "no-audio"
		entry.issues = []StateIssue{errorIssue("no-audio", "目录中没有支持的 MP3 或 FLAC 文件。")}
		return nil
	}
	applicationService, err := entry.planner.runtime.albumService(album, "")
	if err != nil {
		return err
	}
	if album.Scan.MetadataPath != "" {
		entry.candidates = []AlbumCandidate{candidateToDTO(domain.AlbumCandidate{
			ID: "local-json", Name: album.Name, Source: "local-json",
		}, album.Name)}
	} else {
		entry.candidates, err = entry.planner.catalog.search(ctx, applicationService, entry.owner, album.Name, false)
		if err != nil {
			return err
		}
	}
	candidate := exactCandidate(entry.candidates)
	if candidate == nil {
		entry.status = "needs-candidate"
		entry.issues = []StateIssue{warningIssue("candidate-required", "写入前需要选择匹配的专辑，未匹配的专辑会自动跳过。")}
		return nil
	}
	entry.selectedCandidateID = candidate.ID
	entry.plan, err = entry.planner.prepareAlbumPlan(ctx, album, applicationService, candidate.ID, entry.planner.runtime.getConfig().Source, entry.owner)
	return err
}

func (entry *batchEntry) chooseCandidate(ctx context.Context, candidateID string) error {
	index := slices.IndexFunc(entry.candidates, func(candidate AlbumCandidate) bool { return candidate.ID == candidateID })
	candidate := entry.candidates[index]
	entry.selectedCandidateID = candidate.ID
	entry.source = candidate.Source
	plan, err := entry.planner.prepareOwnedPlan(ctx, entry.directory, candidate.ID, candidate.Source, entry.planner.runtime.getConfig().Source, entry.owner)
	entry.plan = plan
	return err
}

func (entry *batchEntry) preview(root string) BatchEntryPreview {
	relative, err := filepath.Rel(root, entry.directory)
	if err != nil {
		relative = filepath.Base(entry.directory)
	}
	status := entry.status
	canRun := entry.canRun()
	issues := dtoSlice(entry.issues)
	if entry.plan != nil {
		issues = append(issues, entry.plan.stateIssues()...)
	}
	readiness, outcome := batchEntryState(status, canRun)
	return BatchEntryPreview{
		ID:                  entry.id,
		RelativePath:        relative,
		InferredAlbumName:   entry.inferredAlbumName,
		Source:              entry.source,
		AudioCount:          entry.audioCount,
		Readiness:           readiness,
		Outcome:             outcome,
		Issues:              issues,
		Candidates:          dtoSlice(entry.candidates),
		SelectedCandidateID: entry.selectedCandidateID,
	}
}

func batchEntryState(status string, canRun bool) (string, string) {
	switch status {
	case "loading":
		return "pending", ""
	case "no-audio":
		return "skipped", ""
	case "scan-failed", "blocked":
		return "blocked", ""
	case "failed":
		if canRun {
			return "ready", "failed"
		}
		return "blocked", "failed"
	case "needs-candidate":
		return "needs-candidate", ""
	case "succeeded":
		if canRun {
			return "ready", "succeeded"
		}
		return "blocked", "succeeded"
	case "cancelled":
		if canRun {
			return "ready", "cancelled"
		}
		return "blocked", "cancelled"
	default:
		if canRun {
			return "ready", ""
		}
		return "blocked", ""
	}
}

func exactCandidate(candidates []AlbumCandidate) *AlbumCandidate {
	for index := range candidates {
		if candidates[index].ExactMatch {
			return &candidates[index]
		}
	}
	return nil
}
