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
		Config:  domain.MetadataConfig{Lyric: &lyric, LyricEnabled: true},
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
		return renameNoReplace(oldPath, newPath)
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

func TestApplyTagPlanRejectsSourceChangedDuringPreparation(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 Track.mp3")
	writeTestFile(t, source, "audio")
	scan, err := albumfs.ScanAlbum(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := BuildTagPlan(scan, []domain.Metadata{{
		Title:       "Track",
		Artists:     []string{},
		TrackNumber: "1",
		DiscNumber:  "1",
	}})
	if err != nil {
		t.Fatal(err)
	}
	changed := false
	service := Service{
		Config:  domain.DefaultMetadataConfig(),
		Writers: tagio.Writers{domain.FormatMP3: &recordingWriter{}},
		Events: func(event domain.ProgressEvent) error {
			if event.Stage != domain.StageWrite || changed {
				return nil
			}
			changed = true
			return os.WriteFile(source, []byte("external source change"), 0o644)
		},
	}
	err = service.ApplyTagPlan(context.Background(), plan)
	if err == nil || !strings.Contains(err.Error(), "changed while preparing") {
		t.Fatalf("ApplyTagPlan() error = %v", err)
	}
	if TagFilesMayHaveChanged(err) {
		t.Fatalf("source snapshot failure was reported as a committed change: %v", err)
	}
	assertFileContent(t, source, "external source change")
	assertNoTemporaryFiles(t, directory)
}

func TestReplaceOriginalsRejectsSourceChangedAfterRevalidation(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 Track.mp3")
	temporary := filepath.Join(directory, ".thtag-write-test")
	writeTestFile(t, source, "original")
	writeTestFile(t, temporary, "prepared")
	items := []domain.TagPlanItem{{SourcePath: source}}
	sources, err := snapshotSources(items)
	if err != nil {
		t.Fatal(err)
	}
	if err := validateSourceSnapshots(sources); err != nil {
		t.Fatal(err)
	}
	changed := false
	move := func(oldPath, newPath string) error {
		if !changed &&
			oldPath == source &&
			strings.Contains(filepath.Base(newPath), ".thtag-backup-") {
			changed = true
			if err := os.WriteFile(source, []byte("late external source"), 0o644); err != nil {
				return err
			}
		}
		return renameNoReplace(oldPath, newPath)
	}
	err = replaceOriginalsWith([]preparedWrite{{
		item:      items[0],
		temporary: temporary,
	}}, sources, move)
	if err == nil || !strings.Contains(err.Error(), "changed before replacement") {
		t.Fatalf("replaceOriginalsWith() error = %v", err)
	}
	assertFileContent(t, source, "late external source")
	assertFileContent(t, temporary, "prepared")
	backups, globErr := filepath.Glob(filepath.Join(directory, ".thtag-backup-*"))
	if globErr != nil {
		t.Fatal(globErr)
	}
	if len(backups) != 0 {
		t.Fatalf("changed source was not restored from backup: %#v", backups)
	}
}

func TestApplyTagPlanDoesNotReplaceTargetCreatedAtRenameStage(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 Old.mp3")
	target := filepath.Join(directory, "01 New.mp3")
	writeTestFile(t, source, "audio")
	scan, err := albumfs.ScanAlbum(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := BuildTagPlan(scan, []domain.Metadata{{
		Title:       "New",
		Artists:     []string{},
		TrackNumber: "1",
		DiscNumber:  "1",
	}})
	if err != nil {
		t.Fatal(err)
	}
	service := Service{
		Config:  domain.DefaultMetadataConfig(),
		Writers: tagio.Writers{domain.FormatMP3: &recordingWriter{}},
		Events: func(event domain.ProgressEvent) error {
			if event.Stage != domain.StageRename {
				return nil
			}
			return os.WriteFile(target, []byte("external target"), 0o644)
		},
	}
	err = service.ApplyTagPlan(context.Background(), plan)
	if err == nil || !TagFilesMayHaveChanged(err) {
		t.Fatalf("ApplyTagPlan() error = %v", err)
	}
	assertFileContent(t, target, "external target")
	assertFileContent(t, source, "audio:New")
	assertNoTemporaryFiles(t, directory)
}

func TestReplaceOriginalsRetainsBackupWhenSourceReappears(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 Track.mp3")
	temporary := filepath.Join(directory, ".thtag-write-test")
	writeTestFile(t, source, "original")
	writeTestFile(t, temporary, "prepared")
	items := []domain.TagPlanItem{{SourcePath: source}}
	sources, err := snapshotSources(items)
	if err != nil {
		t.Fatal(err)
	}
	created := false
	move := func(oldPath, newPath string) error {
		if !created && oldPath == temporary && newPath == source {
			created = true
			if err := os.WriteFile(source, []byte("external"), 0o644); err != nil {
				return err
			}
		}
		return renameNoReplace(oldPath, newPath)
	}
	err = replaceOriginalsWith([]preparedWrite{{
		item:      items[0],
		temporary: temporary,
	}}, sources, move)
	if err == nil {
		t.Fatal("replaceOriginalsWith() unexpectedly replaced a reappeared source")
	}
	assertFileContent(t, source, "external")
	assertFileContent(t, temporary, "prepared")
	backups, globErr := filepath.Glob(filepath.Join(directory, ".thtag-backup-*"))
	if globErr != nil {
		t.Fatal(globErr)
	}
	if len(backups) != 1 {
		t.Fatalf("backup files = %#v", backups)
	}
	assertFileContent(t, backups[0], "original")
	if !strings.Contains(err.Error(), filepath.Base(backups[0])) {
		t.Fatalf("error does not identify retained backup %q: %v", backups[0], err)
	}
}

func TestReplaceOriginalsRetainsBackupChangedInPlace(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 Track.mp3")
	temporary := filepath.Join(directory, ".thtag-write-test")
	writeTestFile(t, source, "original")
	writeTestFile(t, temporary, "prepared")
	items := []domain.TagPlanItem{{SourcePath: source}}
	sources, err := snapshotSources(items)
	if err != nil {
		t.Fatal(err)
	}
	var backup string
	move := func(oldPath, newPath string) error {
		if oldPath == source && strings.Contains(filepath.Base(newPath), ".thtag-backup-") {
			backup = newPath
		}
		if err := renameNoReplace(oldPath, newPath); err != nil {
			return err
		}
		if oldPath == temporary && newPath == source {
			return os.WriteFile(backup, []byte("externally changed backup"), 0o644)
		}
		return nil
	}
	err = replaceOriginalsWith([]preparedWrite{{
		item:      items[0],
		temporary: temporary,
	}}, sources, move)
	if err == nil || !strings.Contains(err.Error(), "changed before cleanup") {
		t.Fatalf("replaceOriginalsWith() error = %v", err)
	}
	assertFileContent(t, source, "prepared")
	assertFileContent(t, backup, "externally changed backup")
}

func TestReplacementRollbackRetainsCurrentFileChangedInPlace(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "01 Track.mp3")
	backup := filepath.Join(directory, ".thtag-backup-test")
	writeTestFile(t, source, "prepared")
	writeTestFile(t, backup, "original")
	written, err := captureOwnedFile(source)
	if err != nil {
		t.Fatal(err)
	}
	var retained string
	move := func(oldPath, newPath string) error {
		if err := renameNoReplace(oldPath, newPath); err != nil {
			return err
		}
		if oldPath == source && strings.Contains(filepath.Base(newPath), ".thtag-rollback-") {
			retained = newPath
			return os.WriteFile(retained, []byte("externally changed current file"), 0o644)
		}
		return nil
	}
	err = rollbackReplacementsWith([]replacement{{
		source:  source,
		backup:  backup,
		written: written,
	}}, move)
	if err == nil || !strings.Contains(err.Error(), "changed during rollback") {
		t.Fatalf("rollbackReplacementsWith() error = %v", err)
	}
	assertFileContent(t, source, "original")
	assertFileContent(t, retained, "externally changed current file")
	if !strings.Contains(err.Error(), filepath.Base(retained)) {
		t.Fatalf("error does not identify retained file %q: %v", retained, err)
	}
}

func TestRenameRollbackDoesNotReplaceReappearedSource(t *testing.T) {
	directory := t.TempDir()
	source := filepath.Join(directory, "A.mp3")
	target := filepath.Join(directory, "B.mp3")
	writeTestFile(t, source, "audio")
	writeTestFile(t, target, "external target")
	created := false
	move := func(oldPath, newPath string) error {
		if !created &&
			strings.Contains(filepath.Base(oldPath), ".thtag-rename-") &&
			newPath == source {
			created = true
			if err := os.WriteFile(source, []byte("external source"), 0o644); err != nil {
				return err
			}
		}
		return renameNoReplace(oldPath, newPath)
	}
	err := renameTwoPhaseWith([]domain.TagPlanItem{{
		SourcePath: source,
		TargetPath: target,
	}}, move)
	if err == nil {
		t.Fatal("renameTwoPhaseWith() unexpectedly replaced an external file")
	}
	assertFileContent(t, source, "external source")
	assertFileContent(t, target, "external target")
	staged, globErr := filepath.Glob(filepath.Join(directory, ".thtag-rename-*"))
	if globErr != nil {
		t.Fatal(globErr)
	}
	if len(staged) != 1 {
		t.Fatalf("staged files = %#v", staged)
	}
	assertFileContent(t, staged[0], "audio")
	if !strings.Contains(err.Error(), filepath.Base(staged[0])) {
		t.Fatalf("error does not identify retained staged file %q: %v", staged[0], err)
	}
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
