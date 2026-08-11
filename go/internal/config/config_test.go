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
	value.LyricEnabled = true
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

func TestResolveAlbumAppliesMetadataAndRunOverrides(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(
		filepath.Join(directory, "thtag.json"),
		[]byte(`{
			"defaultAlbumHint":"Selected Album",
			"source":"doujin-meta",
			"interactive":false,
			"cover":false,
			"lyric":true,
			"lyricType":"mixed",
			"lyricOutput":"lrc",
			"lyricTime":false,
			"lyricCacheSize":32,
			"translationSeparator":" | ",
			"commentLanguage":"jpn",
			"coverCompressSize":0,
			"coverCompressResolution":0,
			"separator":"; ",
			"timeout":12,
			"retry":2
		}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	base := domain.DefaultMetadataConfig()
	base.CoverCompressSize = 2
	base.CoverCompressResolution = 1000
	actual, err := ResolveAlbum(directory, base, false)
	if err != nil {
		t.Fatal(err)
	}
	if actual.DefaultAlbumHint != "Selected Album" ||
		actual.Interactive == nil || *actual.Interactive ||
		actual.Cover == nil || *actual.Cover {
		t.Fatalf("unexpected run options: %#v", actual)
	}
	if actual.Metadata.Source != "doujin-meta" ||
		!actual.Metadata.LyricEnabled ||
		actual.Metadata.CommentLanguage != "jpn" ||
		actual.Metadata.CoverCompressSize != 0 ||
		actual.Metadata.CoverCompressResolution != 0 ||
		actual.Metadata.Separator != "; " ||
		actual.Metadata.Timeout != 12 ||
		actual.Metadata.Retry != 2 {
		t.Fatalf("unexpected metadata config: %#v", actual.Metadata)
	}
	if actual.Metadata.Lyric == nil ||
		actual.Metadata.Lyric.Type != domain.LyricMixed ||
		actual.Metadata.Lyric.Output != domain.LyricLRC ||
		actual.Metadata.Lyric.Time ||
		actual.Metadata.Lyric.MaxCacheSize != 32 ||
		actual.Metadata.Lyric.TranslationSeparator != " | " {
		t.Fatalf("unexpected lyric config: %#v", actual.Metadata.Lyric)
	}
}

func TestResolveAlbumCanDisableLyrics(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "thtag.json"), []byte(`{"lyric":false}`), 0o644); err != nil {
		t.Fatal(err)
	}
	base := domain.DefaultMetadataConfig()
	lyric := domain.DefaultLyricConfig()
	base.Lyric = &lyric
	actual, err := ResolveAlbum(directory, base, true)
	if err != nil {
		t.Fatal(err)
	}
	if actual.Metadata.LyricEnabled || actual.Metadata.Lyric == nil {
		t.Fatalf("ResolveAlbum() metadata = %#v, want disabled lyrics with preferences", actual.Metadata)
	}
}

func TestResolveAlbumRejectsExplicitInvalidOverrides(t *testing.T) {
	for name, input := range map[string]string{
		"empty separator":    `{"separator":""}`,
		"invalid lyric type": `{"lyric":false,"lyricType":"invalid"}`,
		"negative cover":     `{"coverCompressSize":-1}`,
		"zero timeout":       `{"timeout":0}`,
	} {
		t.Run(name, func(t *testing.T) {
			directory := t.TempDir()
			if err := os.WriteFile(filepath.Join(directory, "thtag.json"), []byte(input), 0o644); err != nil {
				t.Fatal(err)
			}
			if _, err := ResolveAlbum(directory, domain.DefaultMetadataConfig(), false); err == nil {
				t.Fatal("ResolveAlbum() accepted invalid album config")
			}
		})
	}
}

func TestLoadLegacyConfigKeepsLyricsDisabled(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())
	path, err := Path()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		path,
		[]byte(`{
			"lyric":{
				"type":"mixed",
				"output":"lrc",
				"time":false,
				"translationSeparator":" | ",
				"maxCacheSize":32
			},
			"source":"thb-wiki",
			"commentLanguage":"zho",
			"coverCompressSize":0,
			"coverCompressResolution":0,
			"separator":" / ",
			"timeout":30,
			"retry":3
		}`),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	actual, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if actual.LyricEnabled {
		t.Fatal("legacy config unexpectedly enabled lyrics")
	}
	if actual.Lyric == nil ||
		actual.Lyric.Type != domain.LyricMixed ||
		actual.Lyric.Output != domain.LyricLRC {
		t.Fatalf("legacy lyric preferences were not preserved: %#v", actual.Lyric)
	}
}
