package bootstrap

import (
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

func TestNewServiceSeparatesStoredLyricPreferenceFromRuntime(t *testing.T) {
	preference := domain.DefaultLyricConfig()
	preference.Output = domain.LyricLRC
	stored := domain.DefaultMetadataConfig()
	stored.Lyric = &preference
	stored.LyricEnabled = false

	service, err := NewService(Options{Config: stored, Sources: source.Registry{}})
	if err != nil {
		t.Fatal(err)
	}
	if service.Config.Lyric != nil {
		t.Fatalf("runtime config enabled stored lyric preference: %#v", service.Config)
	}
	if stored.Lyric == nil || stored.Lyric.Output != domain.LyricLRC {
		t.Fatalf("stored lyric preference was modified: %#v", stored)
	}

	stored.LyricEnabled = true
	service, err = NewService(Options{Config: stored, Sources: source.Registry{}})
	if err != nil {
		t.Fatal(err)
	}
	if service.Config.Lyric == nil || service.Config.Lyric.Output != domain.LyricLRC {
		t.Fatalf("runtime config ignored enabled lyric preference: %#v", service.Config)
	}
}
