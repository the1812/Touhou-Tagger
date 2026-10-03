package bridge

import (
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestSettingsKeepDisabledLyricPreferences(t *testing.T) {
	service := SettingsService{runtime: &runtimeState{sources: []SourceOption{{
		Value:          domain.DefaultMetadataSource,
		SupportsSearch: true,
	}}}}
	value := domain.DefaultMetadataConfig()
	value.CommentLanguage = "zho"
	value.Lyric.Type = domain.LyricMixed
	value.Lyric.Time = false
	value.Lyric.TranslationSeparator = " | "
	value.Lyric.MaxCacheSize = 32
	if err := service.validate(value); err != nil {
		t.Fatal(err)
	}
	service.runtime.setConfig(value)
	actual := service.runtime.getConfig()
	if actual.LyricEnabled || actual.Lyric == nil {
		t.Fatalf("disabled lyrics: %#v", actual)
	}
	if actual.Lyric.Type != value.Lyric.Type || actual.Lyric.TranslationSeparator != " | " || actual.Lyric.MaxCacheSize != 32 {
		t.Fatalf("lyric preferences were not preserved: %#v", actual.Lyric)
	}
	value.LyricEnabled = true
	value.Lyric.Output = domain.LyricLRC
	if err := service.validate(value); err != nil {
		t.Fatal(err)
	}
	service.runtime.setConfig(value)
	actual = service.runtime.getConfig()
	if !actual.LyricEnabled || actual.Lyric.Output != domain.LyricLRC {
		t.Fatalf("LRC output: %#v", actual)
	}
}
