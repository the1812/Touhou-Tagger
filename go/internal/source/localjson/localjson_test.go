package localjson

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestFetchJSONCAndExpand(t *testing.T) {
	path := filepath.Join(t.TempDir(), "metadata.jsonc")
	data := `[
		{
			// Album-level fields can appear once.
			"album": "Album",
			"albumOrder": "CAT-1",
			"title": "One",
			"composers": ["Composer"]
		},
		{"title": "Two", "artists": ["Artist"]},
	]`
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatal(err)
	}
	metadata, err := (Source{}).Fetch(context.Background(), path, []byte("cover"))
	if err != nil {
		t.Fatal(err)
	}
	if len(metadata) != 2 {
		t.Fatalf("got %d tracks, want 2", len(metadata))
	}
	if metadata[0].TrackNumber != "1" || metadata[1].TrackNumber != "2" || metadata[1].Album != "Album" {
		t.Fatalf("metadata was not expanded: %#v", metadata)
	}
	if len(metadata[0].Artists) != 1 || metadata[0].Artists[0] != "Composer" {
		t.Fatalf("composer fallback missing: %#v", metadata[0])
	}
}
