package application

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	albumfs "github.com/the1812/Touhou-Tagger/go/internal/filesystem"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

type recordingWriter struct {
	writes int
	failAt int
}

func (writer *recordingWriter) Write(
	ctx context.Context,
	path string,
	metadata domain.Metadata,
	_ domain.MetadataConfig,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	writer.writes++
	if writer.writes == writer.failAt {
		return fmt.Errorf("injected writer failure")
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		return err
	}
	if _, err := file.WriteString(":" + metadata.Title); err != nil {
		return errors.Join(err, file.Close())
	}
	return file.Close()
}

func TestApplyTagPlanSupportsFilenameSwaps(t *testing.T) {
	directory := t.TempDir()
	first := filepath.Join(directory, "01 B.mp3")
	second := filepath.Join(directory, "02 A.mp3")
	writeTestFile(t, first, "first")
	writeTestFile(t, second, "second")
	scan, err := albumfs.ScanAlbum(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	metadata := []domain.Metadata{
		{Title: "A", Artists: []string{}, TrackNumber: "2", DiscNumber: "1"},
		{Title: "B", Artists: []string{}, TrackNumber: "1", DiscNumber: "1"},
	}
	plan, err := BuildTagPlan(scan, metadata)
	if err != nil {
		t.Fatal(err)
	}
	lyric := domain.DefaultLyricConfig()
	lyric.Output = domain.LyricLRC
	plan.Items[0].Metadata.Lyric = "first lyric"
	writer := &recordingWriter{}
	service := Service{
		Config:  domain.MetadataConfig{Lyric: &lyric},
		Writers: tagio.Writers{domain.FormatMP3: writer},
	}
	if err := service.ApplyTagPlan(context.Background(), plan); err != nil {
		t.Fatal(err)
	}
	assertFileContent(t, second, "first:A")
	assertFileContent(t, first, "second:B")
	assertFileContent(t, filepath.Join(directory, "02 A.lrc"), "first lyric")
	assertNoTemporaryFiles(t, directory)
}

func TestRenameTwoPhaseRestoresSwapAfterCommitFailure(t *testing.T) {
	directory := t.TempDir()
	first := filepath.Join(directory, "A.mp3")
	second := filepath.Join(directory, "B.mp3")
	writeTestFile(t, first, "first")
	writeTestFile(t, second, "second")
	items := []domain.TagPlanItem{
		{SourcePath: first, TargetPath: second},
		{SourcePath: second, TargetPath: first},
	}
	injected := errors.New("injected commit failure")
	failed := false
	rename := func(oldPath, newPath string) error {
		if !failed && strings.Contains(filepath.Base(oldPath), ".thtag-rename-") && newPath == first {
			failed = true
			return injected
		}
		return os.Rename(oldPath, newPath)
	}
	err := renameTwoPhaseWith(items, rename)
	if !errors.Is(err, injected) {
		t.Fatalf("renameTwoPhaseWith() error = %v, want injected failure", err)
	}
	assertFileContent(t, first, "first")
	assertFileContent(t, second, "second")
	assertNoTemporaryFiles(t, directory)
}

func TestApplyTagPlanLeavesOriginalsUntouchedWhenPreparationFails(t *testing.T) {
	directory := t.TempDir()
	first := filepath.Join(directory, "01 One.mp3")
	second := filepath.Join(directory, "02 Two.mp3")
	writeTestFile(t, first, "first")
	writeTestFile(t, second, "second")
	scan, err := albumfs.ScanAlbum(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := BuildTagPlan(scan, []domain.Metadata{
		{Title: "Changed One", Artists: []string{}, TrackNumber: "1", DiscNumber: "1"},
		{Title: "Changed Two", Artists: []string{}, TrackNumber: "2", DiscNumber: "1"},
	})
	if err != nil {
		t.Fatal(err)
	}
	service := Service{
		Config:  domain.DefaultMetadataConfig(),
		Writers: tagio.Writers{domain.FormatMP3: &recordingWriter{failAt: 2}},
	}
	if err := service.ApplyTagPlan(context.Background(), plan); err == nil {
		t.Fatal("expected injected writer failure")
	}
	assertFileContent(t, first, "first")
	assertFileContent(t, second, "second")
	assertNoTemporaryFiles(t, directory)
}

func TestApplyTagPlanAppliesCaseOnlyFilenameChanges(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 song.mp3")
	writeTestFile(t, source, "audio")
	scan, err := albumfs.ScanAlbum(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := BuildTagPlan(scan, []domain.Metadata{
		{Title: "Song", Artists: []string{}, TrackNumber: "1", DiscNumber: "1"},
	})
	if err != nil {
		t.Fatal(err)
	}
	service := Service{
		Config:  domain.DefaultMetadataConfig(),
		Writers: tagio.Writers{domain.FormatMP3: &recordingWriter{}},
	}
	if err := service.ApplyTagPlan(context.Background(), plan); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if entry.Name() == "01 Song.mp3" {
			assertFileContent(t, filepath.Join(directory, entry.Name()), "audio:Song")
			return
		}
	}
	t.Fatalf("case-only rename was not applied: %#v", entries)
}

func TestBuildTagPlanValidatesTrackCountAndConflicts(t *testing.T) {
	directory := t.TempDir()
	writeTestFile(t, filepath.Join(directory, "01 One.mp3"), "first")
	scan, err := albumfs.ScanAlbum(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := BuildTagPlan(scan, nil); err == nil || !strings.Contains(err.Error(), "track count mismatch") {
		t.Fatalf("unexpected track-count result: %v", err)
	}
	writeTestFile(t, filepath.Join(directory, "01 Existing.mp3"), "occupied")
	if _, err := BuildTagPlan(scan, []domain.Metadata{
		{Title: "Existing", Artists: []string{}, TrackNumber: "1", DiscNumber: "1"},
	}); err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("unexpected conflict result: %v", err)
	}
}

func TestBatchContinuesAfterAlbumPreflightFailure(t *testing.T) {
	root := t.TempDir()
	broken := filepath.Join(root, "01 Broken")
	valid := filepath.Join(root, "02 Valid")
	if err := os.MkdirAll(broken, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(valid, 0o755); err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, filepath.Join(broken, "01 Track.mp3"), "broken")
	writeTestFile(t, filepath.Join(broken, "thtag.json"), "{")
	writeTestFile(t, filepath.Join(valid, "01 Track.mp3"), "valid")
	service := Service{}
	jobs, err := service.ScanBatch(context.Background(), root, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 2 || jobs[0].PreflightErr == nil || jobs[1].PreflightErr != nil {
		t.Fatalf("unexpected batch jobs: %#v", jobs)
	}
	runs := 0
	results := service.RunBatch(context.Background(), jobs, func(_ context.Context, job domain.BatchJob) error {
		runs++
		if job.Directory != valid {
			t.Fatalf("unexpected executed job: %#v", job)
		}
		return nil
	})
	if runs != 1 || len(results) != 2 || results[0].Err == nil || results[1].Err != nil {
		t.Fatalf("unexpected batch results: runs=%d results=%#v", runs, results)
	}
}

func writeTestFile(t testing.TB, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertFileContent(t testing.TB, path, expected string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != expected {
		t.Fatalf("%s contains %q, want %q", path, data, expected)
	}
}

func assertNoTemporaryFiles(t testing.TB, directory string) {
	t.Helper()
	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if strings.Contains(entry.Name(), ".thtag-") {
			t.Errorf("temporary file was not removed: %s", entry.Name())
		}
	}
}
