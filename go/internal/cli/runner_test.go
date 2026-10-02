package cli

import (
	"bufio"
	"bytes"
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestSelectCandidateTreatsInvalidInteractiveInputAsCancellation(t *testing.T) {
	runner := terminal{
		input:  bufio.NewReader(strings.NewReader("cancel\n")),
		output: &bytes.Buffer{},
	}
	selected, ok, err := runner.selectCandidate(context.Background(), []domain.AlbumCandidate{
		{ID: "one", Name: "One"},
		{ID: "two", Name: "Two"},
	}, "query", true)
	if err != nil || ok || !reflect.DeepEqual(selected, domain.AlbumCandidate{}) {
		t.Fatalf("selectCandidate() = (%#v, %t, %v), want normal cancellation", selected, ok, err)
	}
}

func TestAlbumOptionsApplyExplicitFalseAndZero(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(
		filepath.Join(directory, "thtag.json"),
		[]byte(`{
			"interactive":false,
			"cover":false,
			"lyric":true,
			"lyricType":"mixed",
			"lyricTime":false,
			"coverCompressResolution":0
		}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	options := newOptions(domain.DefaultMetadataConfig())
	options.Cover = true
	options.Metadata.CoverCompressResolution = 1000
	actual, err := config.ResolveAlbum(directory, options.RuntimeAlbumOptions)
	if err != nil {
		t.Fatal(err)
	}
	if actual.Interactive ||
		actual.Cover ||
		!actual.Metadata.LyricEnabled ||
		actual.Metadata.Lyric.Type != domain.LyricMixed ||
		actual.Metadata.Lyric.Time ||
		actual.Metadata.CoverCompressResolution != 0 {
		t.Fatalf("ResolveAlbum() ignored explicit false/zero: %#v", actual)
	}
}

func TestCLISeparatesLyricPreferenceFromRunFlag(t *testing.T) {
	stored := domain.DefaultMetadataConfig()
	stored.LyricEnabled = false
	options := newOptions(stored)
	if options.Metadata.LyricEnabled || options.lyricPreference {
		t.Fatalf("newOptions() enabled lyrics: %#v", options)
	}
	if config.RuntimeMetadata(options.Metadata).Lyric != nil {
		t.Fatal("runtime config kept disabled lyric preferences")
	}
	options.Metadata.LyricEnabled = true
	runtimeConfig := config.RuntimeMetadata(options.Metadata)
	if !runtimeConfig.LyricEnabled || runtimeConfig.Lyric == nil {
		t.Fatal("runtime config ignored --lyric")
	}
	persistedConfig := options.persistedConfig()
	if persistedConfig.LyricEnabled || persistedConfig.Lyric == nil {
		t.Fatal("running with --lyric changed the persisted GUI preference")
	}

	stored.LyricEnabled = true
	options = newOptions(stored)
	if options.Metadata.LyricEnabled || !options.lyricPreference {
		t.Fatalf("newOptions() reused stored preference as a run flag: %#v", options)
	}
	if !options.persistedConfig().LyricEnabled {
		t.Fatal("persisted lyric preference was lost")
	}
}
