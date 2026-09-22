package bridge

import (
	"os"
	"path/filepath"
	"testing"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestInspectPlanOutputsAllowsExistingLRC(t *testing.T) {
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
	if len(issues) != 0 {
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
