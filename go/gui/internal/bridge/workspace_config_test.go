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
	preview, err := backend.Batch.ScanBatch(context.Background(), root, 1, domain.DefaultMetadataSource)
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Jobs) != 1 ||
		preview.Jobs[0].Source != "local-json" ||
		preview.Jobs[0].Status == "scan-failed" {
		t.Fatalf("ScanBatch() = %#v", preview)
	}
	backend.Batch.mu.RLock()
	session := backend.Batch.sessions[preview.BatchID]
	backend.Batch.mu.RUnlock()
	session.mu.Lock()
	planID := session.jobs[0].planID
	session.mu.Unlock()
	planSession, exists := backend.plans.get(planID)
	if !exists {
		t.Fatalf("plan %q does not exist", planID)
	}
	planSession.mu.Lock()
	defer planSession.mu.Unlock()
	if planSession.config.Lyric != nil {
		t.Fatalf("runtime plan config retained disabled lyric preferences: %#v", planSession.config)
	}
	planPreview := backend.Workspace.previewLocked(planSession)
	if planPreview.Options.LRCFiles != 0 {
		t.Fatalf("disabled lyrics produced %d LRC preview outputs", planPreview.Options.LRCFiles)
	}
	for _, output := range planSession.snapshot.Outputs {
		if output.Kind == coreapp.OutputLRC {
			t.Fatalf("disabled lyrics produced an LRC output snapshot: %#v", output)
		}
	}
}
