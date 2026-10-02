package application

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

func TestValidatePlanOutputsAllowsUpdatesAndRejectsConflicts(t *testing.T) {
	directory := t.TempDir()
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	config := domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true}
	target := filepath.Join(directory, "01 Song.mp3")
	plan := PlanPreview{Items: []domain.PlanItem{{
		TargetPath: target,
		Metadata:   domain.Metadata{Lyric: "lyrics"},
	}}}
	if err := os.WriteFile(LRCPath(target), []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validatePlanOutputs(lyricOutputs(plan, config)); err != nil {
		t.Fatalf("existing LRC cannot be updated: %v", err)
	}
	if err := os.Remove(LRCPath(target)); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(LRCPath(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := validatePlanOutputs(lyricOutputs(plan, config)); err == nil ||
		!strings.Contains(err.Error(), "already exists") ||
		!PlanOutputsChanged(err) {
		t.Fatalf("validatePlanOutputs() error = %v", err)
	}

	plan.Items = append(plan.Items, domain.PlanItem{
		TargetPath: filepath.Join(directory, "01 Song.flac"),
		Metadata:   domain.Metadata{Lyric: "other lyrics"},
	})
	conflicts := InspectPlanOutputs(lyricOutputs(plan, config))
	foundDuplicate := false
	for _, conflict := range conflicts {
		foundDuplicate = foundDuplicate || conflict.Kind == OutputConflictDuplicate
	}
	if !foundDuplicate {
		t.Fatalf("InspectPlanOutputs() conflicts = %#v, want duplicate", conflicts)
	}
}

func TestLyricOutputsIgnoresDisabledLyricPreference(t *testing.T) {
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	plan := PlanPreview{Items: []domain.PlanItem{{
		TargetPath: "01 Song.mp3",
		Metadata:   domain.Metadata{Lyric: "lyrics"},
	}}}
	if outputs := lyricOutputs(plan, domain.MetadataConfig{Lyric: &lyric}); len(outputs) != 0 {
		t.Fatalf("lyricOutputs() = %#v with lyrics disabled", outputs)
	}
}

func TestPlanExecuteUpdatesExistingLRC(t *testing.T) {
	directory := t.TempDir()
	audioPath := filepath.Join(directory, "01 Song.mp3")
	if err := os.WriteFile(audioPath, []byte("audio"), 0o644); err != nil {
		t.Fatal(err)
	}
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	scan := domain.AlbumScan{Directory: directory, AudioFiles: []domain.AudioFile{{Path: audioPath, Format: domain.FormatMP3}}}
	metadata := []domain.Metadata{{Title: "Song", TrackNumber: "1", DiscNumber: "1"}}

	if err := os.WriteFile(LRCPath(audioPath), []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	writer := &recordingWriter{}
	service := Service{
		Config:  domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true},
		Writers: tagio.Writers{domain.FormatMP3: writer},
	}
	for _, lyric := range []string{"first update", "second update"} {
		metadata[0].Lyric = lyric
		plan, err := service.CreatePlan(context.Background(), scan, metadata, PlanOptions{Candidate: domain.AlbumCandidate{Source: "local-json"}})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := plan.Execute(context.Background()); err != nil {
			t.Fatal(err)
		}
		actual, err := os.ReadFile(LRCPath(audioPath))
		if err != nil {
			t.Fatal(err)
		}
		if string(actual) != lyric {
			t.Fatalf("LRC = %q, want %q", actual, lyric)
		}
	}
	if writer.writes != 2 {
		t.Fatalf("writer calls = %d, want 2", writer.writes)
	}
}

func TestSaveCoverNewNeverOverwritesExistingFile(t *testing.T) {
	cover, err := os.ReadFile(filepath.Join(
		"..", "..", "..", "fixtures", "media", "images", "cover.jpg",
	))
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	path, err := CoverPath(directory, cover)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := SaveCoverNew(directory, cover); err == nil {
		t.Fatal("SaveCoverNew() unexpectedly overwrote an existing file")
	}
	actual, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != "keep" {
		t.Fatalf("existing cover changed to %q", actual)
	}
}
