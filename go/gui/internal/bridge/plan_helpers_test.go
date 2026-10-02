package bridge

import (
	"os"
	"path/filepath"
	"testing"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
)

func TestInspectPlanOutputsAllowsExistingLRC(t *testing.T) {
	directory := t.TempDir()
	output := coreapp.PlanOutput{Kind: coreapp.OutputLRC, Path: filepath.Join(directory, "01 Track.lrc"), ItemIndex: 0}
	if err := os.WriteFile(output.Path, []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	issues := inspectPlanOutputs(coreapp.InspectPlanOutputs([]coreapp.PlanOutput{output}))
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
	issues := inspectPlanOutputs(coreapp.InspectPlanOutputs([]coreapp.PlanOutput{{
		Kind: coreapp.OutputCover, Path: coverPath, ItemIndex: -1, Replace: true,
	}}))
	if len(issues) != 0 {
		t.Fatalf("inspectPlanOutputs() issues = %#v", issues)
	}
}
