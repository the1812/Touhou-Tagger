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

func TestPlanInputSnapshotRejectsLocalInputChanges(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		selectIt func(*domain.AlbumScan, string)
	}{
		{
			name:     "local cover",
			fileName: "cover.jpg",
			selectIt: func(scan *domain.AlbumScan, path string) { scan.CoverPath = path },
		},
		{
			name:     "metadata",
			fileName: "metadata.json",
			selectIt: func(scan *domain.AlbumScan, path string) { scan.MetadataPath = path },
		},
		{
			name:     "album config",
			fileName: "thtag.json",
			selectIt: func(_ *domain.AlbumScan, _ string) {},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			directory := t.TempDir()
			audioPath := filepath.Join(directory, "01 Track.mp3")
			inputPath := filepath.Join(directory, test.fileName)
			if err := os.WriteFile(audioPath, []byte("audio"), 0o644); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(inputPath, []byte("aaaa"), 0o644); err != nil {
				t.Fatal(err)
			}
			scan := domain.AlbumScan{
				Directory: directory,
				AudioFiles: []domain.AudioFile{{
					Path:   audioPath,
					Format: domain.FormatMP3,
				}},
			}
			test.selectIt(&scan, inputPath)
			snapshot, err := snapshotPlanInputs(scan)
			if err != nil {
				t.Fatal(err)
			}
			info, err := os.Stat(inputPath)
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(inputPath, []byte("bbbb"), 0o644); err != nil {
				t.Fatal(err)
			}
			if err := os.Chtimes(inputPath, info.ModTime(), info.ModTime()); err != nil {
				t.Fatal(err)
			}
			if err := validatePlanInputs(scan, snapshot); err == nil {
				t.Fatal("validatePlanInputs() accepted changed input")
			}
		})
	}
}

func TestPlanInputSnapshotRejectsNewLocalCover(t *testing.T) {
	directory := t.TempDir()
	scan := domain.AlbumScan{Directory: directory}
	snapshot, err := snapshotPlanInputs(scan)
	if err != nil {
		t.Fatal(err)
	}
	current := scan
	current.CoverPath = filepath.Join(directory, "cover.jpg")
	if err := os.WriteFile(current.CoverPath, []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validatePlanInputs(current, snapshot); err == nil {
		t.Fatal("validatePlanInputs() accepted a newly created local cover")
	}
}

func TestPlanOutputSnapshotRejectsNewSidecarTargets(t *testing.T) {
	cover, err := os.ReadFile(filepath.Join(
		"..", "..", "..", "..", "fixtures", "media", "images", "cover.jpg",
	))
	if err != nil {
		t.Fatal(err)
	}
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	config := domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true}

	for _, kind := range []string{coreapp.OutputLRC, coreapp.OutputCover} {
		t.Run(kind, func(t *testing.T) {
			directory := t.TempDir()
			plan := domain.TagPlan{Items: []domain.TagPlanItem{{
				TargetPath: filepath.Join(directory, "01 Track.mp3"),
				Metadata:   domain.Metadata{Lyric: "lyrics"},
			}}}
			snapshot, issues := snapshotPlanOutputs(plan, config, directory, cover, true, "")
			if len(issues) != 0 {
				t.Fatalf("snapshotPlanOutputs() issues = %#v", issues)
			}
			var target string
			if kind == coreapp.OutputLRC {
				target = coreapp.LRCPath(plan.Items[0].TargetPath)
			} else {
				target, err = coreapp.CoverPath(directory, cover)
				if err != nil {
					t.Fatal(err)
				}
			}
			if err := os.WriteFile(target, []byte("new"), 0o644); err != nil {
				t.Fatal(err)
			}
			if err := validatePlanOutputs(
				plan,
				config,
				directory,
				cover,
				true,
				"",
				snapshot,
			); err == nil {
				t.Fatalf("validatePlanOutputs() accepted new %s target", kind)
			}
		})
	}
}

func TestPlanOutputSnapshotReportsExistingTargets(t *testing.T) {
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
	_, issues := snapshotPlanOutputs(plan, config, directory, nil, false, "")
	if len(issues) != 1 || issues[0].Code != "lrc-target-exists" {
		t.Fatalf("snapshotPlanOutputs() issues = %#v", issues)
	}
}

func TestPlanOutputSnapshotAllowsSelectedCoverOverwrite(t *testing.T) {
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

	snapshot, issues := snapshotPlanOutputs(
		domain.TagPlan{},
		domain.MetadataConfig{},
		directory,
		cover,
		true,
		coverPath,
	)
	if len(issues) != 0 {
		t.Fatalf("snapshotPlanOutputs() issues = %#v", issues)
	}
	if len(snapshot) != 1 || !equalPath(snapshot[0].File.Path, coverPath) {
		t.Fatalf("snapshotPlanOutputs() path = %#v, want %q", snapshot, coverPath)
	}
	if err := validatePlanOutputs(
		domain.TagPlan{},
		domain.MetadataConfig{},
		directory,
		cover,
		true,
		coverPath,
		snapshot,
	); err != nil {
		t.Fatalf("validatePlanOutputs() rejected selected cover overwrite: %v", err)
	}
}
