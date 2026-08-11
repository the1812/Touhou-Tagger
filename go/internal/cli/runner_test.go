package cli

import (
	"bufio"
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestSelectCandidateTreatsInvalidInteractiveInputAsCancellation(t *testing.T) {
	runner := Runner{
		input:  bufio.NewReader(strings.NewReader("cancel\n")),
		output: &bytes.Buffer{},
	}
	selected, ok, err := runner.selectCandidate([]domain.AlbumCandidate{
		{ID: "one", Name: "One"},
		{ID: "two", Name: "Two"},
	}, "query", true)
	if err != nil || ok || selected != (domain.AlbumCandidate{}) {
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
	options.CoverCompressResolution = 1000
	actual, err := options.forDirectory(directory)
	if err != nil {
		t.Fatal(err)
	}
	if actual.Interactive ||
		actual.Cover ||
		!actual.Lyric ||
		actual.LyricType != "mixed" ||
		actual.LyricTime ||
		actual.CoverCompressResolution != 0 {
		t.Fatalf("forDirectory() ignored explicit false/zero: %#v", actual)
	}
}

func TestCLISeparatesLyricPreferenceFromRunFlag(t *testing.T) {
	stored := domain.DefaultMetadataConfig()
	stored.LyricEnabled = false
	options := newOptions(stored)
	if options.Lyric || options.LyricEnabled {
		t.Fatalf("newOptions() enabled lyrics: %#v", options)
	}
	if options.metadataConfig().Lyric != nil {
		t.Fatal("runtime config kept disabled lyric preferences")
	}
	options.Lyric = true
	runtimeConfig := options.metadataConfig()
	if !runtimeConfig.LyricEnabled || runtimeConfig.Lyric == nil {
		t.Fatal("runtime config ignored --lyric")
	}
	persistedConfig := options.persistedConfig()
	if persistedConfig.LyricEnabled || persistedConfig.Lyric == nil {
		t.Fatal("running with --lyric changed the persisted GUI preference")
	}

	stored.LyricEnabled = true
	options = newOptions(stored)
	if options.Lyric || !options.LyricEnabled {
		t.Fatalf("newOptions() reused stored preference as a run flag: %#v", options)
	}
	if !options.persistedConfig().LyricEnabled {
		t.Fatal("persisted lyric preference was lost")
	}
}
