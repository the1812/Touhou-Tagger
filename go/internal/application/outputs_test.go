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

func TestValidateTagPlanOutputsRejectsExistingAndDuplicateLRC(t *testing.T) {
	directory := t.TempDir()
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	config := domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true}
	target := filepath.Join(directory, "01 Song.mp3")
	plan := domain.TagPlan{Items: []domain.TagPlanItem{{
		TargetPath: target,
		Metadata:   domain.Metadata{Lyric: "lyrics"},
	}}}
	if err := os.WriteFile(LRCPath(target), []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := ValidateTagPlanOutputs(plan, config); err == nil ||
		!strings.Contains(err.Error(), "already exists") ||
		!PlanOutputsChanged(err) {
		t.Fatalf("ValidateTagPlanOutputs() error = %v", err)
	}

	plan.Items = append(plan.Items, domain.TagPlanItem{
		TargetPath: filepath.Join(directory, "01 Song.flac"),
		Metadata:   domain.Metadata{Lyric: "other lyrics"},
	})
	conflicts := InspectPlanOutputs(TagPlanOutputs(plan, config))
	foundDuplicate := false
	for _, conflict := range conflicts {
		foundDuplicate = foundDuplicate || conflict.Kind == OutputConflictDuplicate
	}
	if !foundDuplicate {
		t.Fatalf("InspectPlanOutputs() conflicts = %#v, want duplicate", conflicts)
	}
}

func TestTagPlanOutputsIgnoresDisabledLyricPreference(t *testing.T) {
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	plan := domain.TagPlan{Items: []domain.TagPlanItem{{
		TargetPath: "01 Song.mp3",
		Metadata:   domain.Metadata{Lyric: "lyrics"},
	}}}
	if outputs := TagPlanOutputs(plan, domain.MetadataConfig{Lyric: &lyric}); len(outputs) != 0 {
		t.Fatalf("TagPlanOutputs() = %#v with lyrics disabled", outputs)
	}
}

func TestApplyTagPlanRejectsLRCConflictBeforePreparingAudio(t *testing.T) {
	directory := t.TempDir()
	audioPath := filepath.Join(directory, "01 Song.mp3")
	if err := os.WriteFile(audioPath, []byte("audio"), 0o644); err != nil {
		t.Fatal(err)
	}
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	plan := domain.TagPlan{
		Directory: directory,
		Items: []domain.TagPlanItem{{
			SourcePath: audioPath,
			TargetPath: audioPath,
			Format:     domain.FormatMP3,
			Metadata:   domain.Metadata{Lyric: "lyrics"},
		}},
	}
	if err := os.WriteFile(LRCPath(audioPath), []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	writer := &recordingWriter{}
	service := Service{
		Config:  domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true},
		Writers: tagio.Writers{domain.FormatMP3: writer},
	}
	if err := service.ApplyTagPlan(context.Background(), plan); err == nil {
		t.Fatal("ApplyTagPlan() accepted an existing LRC target")
	}
	if writer.writes != 0 {
		t.Fatalf("writer was called %d times before output validation", writer.writes)
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
