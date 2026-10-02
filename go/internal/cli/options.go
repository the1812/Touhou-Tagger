package cli

import (
	"fmt"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type Options struct {
	config.RuntimeAlbumOptions
	Debug           bool
	Batch           string
	BatchDepth      int
	NoInteractive   bool
	lyricPreference bool
}

func newOptions(value domain.MetadataConfig) Options {
	lyric := domain.DefaultLyricConfig()
	if value.Lyric != nil {
		lyric = *value.Lyric
	}
	value.Lyric = &lyric
	preference := value.LyricEnabled
	value.LyricEnabled = false
	return Options{
		RuntimeAlbumOptions: config.RuntimeAlbumOptions{Metadata: value, Interactive: true},
		BatchDepth:          1,
		lyricPreference:     preference,
	}
}

func (options Options) persistedConfig() domain.MetadataConfig {
	value := options.Metadata
	value.LyricEnabled = options.lyricPreference
	return value
}

func validateOptions(options Options) error {
	if options.BatchDepth < 1 {
		return fmt.Errorf("batch depth must be at least 1")
	}
	if err := config.ValidateMetadata(options.Metadata); err != nil {
		return err
	}
	switch options.Metadata.Source {
	case "thb-wiki", "doujin-meta", "music-brainz", "discogs":
		return nil
	default:
		return fmt.Errorf("unsupported metadata source %q", options.Metadata.Source)
	}
}
