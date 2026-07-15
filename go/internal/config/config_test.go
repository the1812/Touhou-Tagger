package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestSharedConfigRoundTrip(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())
	value := domain.DefaultMetadataConfig()
	lyric := domain.DefaultLyricConfig()
	value.Lyric = &lyric
	value.CoverCompressSize = 2
	value.CoverCompressResolution = 1000
	if err := Save(value); err != nil {
		t.Fatal(err)
	}
	actual, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual, value) {
		t.Fatalf("Load() = %#v, want %#v", actual, value)
	}
}

func TestAlbumHintPreservesUnknownFieldsAndZeroOverrides(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "thtag.json")
	input := []byte(`{"source":"doujin-meta","coverCompressResolution":0,"future":{"keep":true}}`)
	if err := os.WriteFile(path, input, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := SaveDefaultAlbumHint(directory, "Selected Album"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatal(err)
	}
	var future map[string]bool
	if err := json.Unmarshal(raw["future"], &future); err != nil || !future["keep"] {
		t.Fatalf("future field changed: %s (%v)", raw["future"], err)
	}
	options, err := LoadAlbum(directory)
	if err != nil {
		t.Fatal(err)
	}
	if options.DefaultAlbumHint != "Selected Album" || options.CoverCompressResolution == nil || *options.CoverCompressResolution != 0 {
		t.Fatalf("unexpected album options: %#v", options)
	}
}
