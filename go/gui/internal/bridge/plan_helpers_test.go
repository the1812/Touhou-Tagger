package bridge

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestWithoutCompleteEventsDefersOnlyFinalProgress(t *testing.T) {
	var stages []domain.EventStage
	sink := withoutCompleteEvents(func(event domain.ProgressEvent) error {
		stages = append(stages, event.Stage)
		return nil
	})
	if err := sink(domain.ProgressEvent{Stage: domain.StageWrite}); err != nil {
		t.Fatal(err)
	}
	if err := sink(domain.ProgressEvent{Stage: domain.StageComplete}); err != nil {
		t.Fatal(err)
	}
	if len(stages) != 1 || stages[0] != domain.StageWrite {
		t.Fatalf("forwarded stages = %#v", stages)
	}

	expected := errors.New("event failure")
	failing := withoutCompleteEvents(func(domain.ProgressEvent) error { return expected })
	if err := failing(domain.ProgressEvent{Stage: domain.StageWrite}); !errors.Is(err, expected) {
		t.Fatalf("forwarded error = %v", err)
	}
	if withoutCompleteEvents(nil) != nil {
		t.Fatal("nil event sink should remain nil")
	}
}

func TestInspectPlanOutputsReportsExistingTargets(t *testing.T) {
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	config := domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true}
	directory := t.TempDir()
	plan := domain.TagPlan{Items: []domain.TagPlanItem{{
		TargetPath: filepath.Join(directory, "01 Track.mp3"),
		Metadata:   domain.Metadata{Lyric: "lyrics"},
	}}}
	if err := os.WriteFile(coreapp.LRCPath(plan.Items[0].TargetPath), []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	issues := inspectPlanOutputs(plan, config, directory, nil, false, "")
	if len(issues) != 1 || issues[0].Code != "lrc-target-exists" {
		t.Fatalf("inspectPlanOutputs() issues = %#v", issues)
	}
}

func TestInspectPlanOutputsAllowsSelectedCoverOverwrite(t *testing.T) {
	cover, err := os.ReadFile(filepath.Join(
		"..", "..", "..", "..", "fixtures", "media", "images", "cover.jpg",
	))
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	coverPath := filepath.Join(directory, "cover.jpeg")
	if err := os.WriteFile(coverPath, cover, 0o644); err != nil {
		t.Fatal(err)
	}
	issues := inspectPlanOutputs(
		domain.TagPlan{},
		domain.MetadataConfig{},
		directory,
		cover,
		true,
		coverPath,
	)
	if len(issues) != 0 {
		t.Fatalf("inspectPlanOutputs() issues = %#v", issues)
	}
}
