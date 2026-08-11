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
	settings := Settings{
		DefaultSource:               domain.DefaultMetadataSource,
		CommentLanguage:             "zho",
		MP3MultiValueSeparator:      domain.DefaultMetadataSeparator,
		RequestTimeoutSeconds:       30,
		RetryCount:                  3,
		CoverCompressionThresholdKB: 0,
		CoverMaxEdge:                0,
		LyricType:                   string(domain.LyricMixed),
		PreserveLyricTimeline:       false,
		MixedLyricSeparator:         " | ",
		LyricCacheSize:              32,
	}
	value, err := service.configFromSettings(settings)
	if err != nil {
		t.Fatal(err)
	}
	if value.LyricEnabled || value.Lyric == nil {
		t.Fatalf("configFromSettings() = %#v", value)
	}
	if value.Lyric.Type != domain.LyricMixed ||
		value.Lyric.TranslationSeparator != " | " ||
		value.Lyric.MaxCacheSize != 32 {
		t.Fatalf("lyric preferences were not preserved: %#v", value.Lyric)
	}
	actual := settingsFromConfig(value)
	if actual.WriteLyricsMetadata || actual.WriteLRCFiles {
		t.Fatalf("settingsFromConfig() enabled lyric output: %#v", actual)
	}
	if actual.LyricType != settings.LyricType ||
		actual.MixedLyricSeparator != settings.MixedLyricSeparator ||
		actual.LyricCacheSize != settings.LyricCacheSize {
		t.Fatalf("settingsFromConfig() lost lyric preferences: %#v", actual)
	}

	settings.WriteLRCFiles = true
	value, err = service.configFromSettings(settings)
	if err != nil {
		t.Fatal(err)
	}
	if !value.LyricEnabled || value.Lyric == nil || value.Lyric.Output != domain.LyricLRC {
		t.Fatalf("configFromSettings() ignored LRC output: %#v", value)
	}
	actual = settingsFromConfig(value)
	if !actual.WriteLRCFiles || actual.WriteLyricsMetadata {
		t.Fatalf("settingsFromConfig() lost LRC output: %#v", actual)
	}
}
