package bridge

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
	"github.com/the1812/Touhou-Tagger/go/internal/source/localjson"
)

func TestLocalMetadataDoesNotRequireSearchableAlbumSource(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "Album")
	if err := os.Mkdir(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "01 Track.mp3"), []byte("audio"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(directory, "metadata.json"),
		[]byte(`[{"title":"Track","trackNumber":"1","discNumber":"1","lyric":"lyrics"}]`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(directory, "thtag.json"),
		[]byte(`{"source":"unsupported"}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	storedConfig := domain.DefaultMetadataConfig()
	storedConfig.Lyric.Output = domain.LyricLRC
	storedConfig.LyricEnabled = false
	backend := NewBackend(BackendOptions{
		Config: storedConfig,
		Factory: func(value domain.MetadataConfig, events coreapp.EventSink) (*coreapp.Service, error) {
			return &coreapp.Service{
				Config: config.RuntimeMetadata(value),
				Events: events,
				Sources: source.Registry{
					"local-json": localjson.Source{},
				},
			}, nil
		},
		Sources: []SourceOption{{
			Value:          domain.DefaultMetadataSource,
			SupportsSearch: true,
		}},
	})
	defer backend.Close()

	summary, err := backend.Workspace.ScanWorkspace(context.Background(), directory)
	if err != nil {
		t.Fatal(err)
	}
	if !summary.HasMetadataJSON || summary.EffectiveSource != "local-json" {
		t.Fatalf("ScanWorkspace() = %#v", summary)
	}
	plan, err := backend.Workspace.PreparePlan(
		context.Background(),
		directory,
		"local-json",
		"local-json",
	)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Options.LRCFiles != 0 {
		t.Fatalf("disabled lyrics produced %d LRC preview outputs", plan.Options.LRCFiles)
	}
	preview, err := backend.Batch.ScanBatch(context.Background(), root, 1, domain.DefaultMetadataSource)
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Jobs) != 1 || preview.Jobs[0].Status != "loading" {
		t.Fatalf("ScanBatch() = %#v", preview)
	}
	job, err := backend.Batch.LoadBatchJob(context.Background(), preview.BatchID, preview.Jobs[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Source != "local-json" || job.Status == "scan-failed" {
		t.Fatalf("LoadBatchJob() = %#v", job)
	}
}
