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
		[]byte(`{"interactive":false,"coverCompressResolution":0}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	options := newOptions(domain.DefaultMetadataConfig())
	options.CoverCompressResolution = 1000
	actual, err := options.forDirectory(directory)
	if err != nil {
		t.Fatal(err)
	}
	if actual.Interactive || actual.CoverCompressResolution != 0 {
		t.Fatalf("forDirectory() ignored explicit false/zero: %#v", actual)
	}
}
