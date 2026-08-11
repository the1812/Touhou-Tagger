package cli

import (
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type Options struct {
	Cover                   bool
	Debug                   bool
	Batch                   string
	BatchDepth              int
	CommentLanguage         string
	CoverCompressSize       float64
	CoverCompressResolution int
	Source                  string
	Lyric                   bool
	LyricEnabled            bool
	LyricType               string
	LyricOutput             string
	LyricCacheSize          int
	TranslationSeparator    string
	LyricTime               bool
	Separator               string
	Timeout                 int
	Retry                   int
	Interactive             bool
	NoInteractive           bool
}

func newOptions(value domain.MetadataConfig) Options {
	lyric := domain.DefaultLyricConfig()
	if value.Lyric != nil {
		lyric = *value.Lyric
	}
	return Options{
		BatchDepth:              1,
		CommentLanguage:         value.CommentLanguage,
		CoverCompressSize:       value.CoverCompressSize,
		CoverCompressResolution: value.CoverCompressResolution,
		Source:                  value.Source,
		LyricEnabled:            value.LyricEnabled,
		LyricType:               string(lyric.Type),
		LyricOutput:             string(lyric.Output),
		LyricCacheSize:          lyric.MaxCacheSize,
		TranslationSeparator:    lyric.TranslationSeparator,
		LyricTime:               lyric.Time,
		Separator:               value.Separator,
		Timeout:                 value.Timeout,
		Retry:                   value.Retry,
		Interactive:             true,
	}
}

func (options Options) metadataConfig() domain.MetadataConfig {
	return config.RuntimeMetadata(options.config(options.Lyric))
}

func (options Options) persistedConfig() domain.MetadataConfig {
	return options.config(options.LyricEnabled)
}

func (options Options) config(lyricEnabled bool) domain.MetadataConfig {
	return domain.MetadataConfig{
		Lyric:                   options.lyricConfig(),
		LyricEnabled:            lyricEnabled,
		Source:                  options.Source,
		CommentLanguage:         options.CommentLanguage,
		CoverCompressSize:       options.CoverCompressSize,
		CoverCompressResolution: options.CoverCompressResolution,
		Separator:               options.Separator,
		Timeout:                 options.Timeout,
		Retry:                   options.Retry,
	}
}

func (options Options) lyricConfig() *domain.LyricConfig {
	return &domain.LyricConfig{
		Type:                 domain.LyricType(options.LyricType),
		Output:               domain.LyricOutput(options.LyricOutput),
		Time:                 options.LyricTime,
		TranslationSeparator: options.TranslationSeparator,
		MaxCacheSize:         options.LyricCacheSize,
	}
}

func (options Options) forDirectory(directory string) (Options, error) {
	resolved, err := config.ResolveAlbum(directory, options.persistedConfig(), options.Lyric)
	if err != nil {
		return Options{}, err
	}
	options.Source = resolved.Metadata.Source
	options.CommentLanguage = resolved.Metadata.CommentLanguage
	options.CoverCompressSize = resolved.Metadata.CoverCompressSize
	options.CoverCompressResolution = resolved.Metadata.CoverCompressResolution
	options.Separator = resolved.Metadata.Separator
	options.Timeout = resolved.Metadata.Timeout
	options.Retry = resolved.Metadata.Retry
	options.Lyric = resolved.Metadata.LyricEnabled
	options.LyricType = string(resolved.Lyric.Type)
	options.LyricOutput = string(resolved.Lyric.Output)
	options.LyricTime = resolved.Lyric.Time
	options.LyricCacheSize = resolved.Lyric.MaxCacheSize
	options.TranslationSeparator = resolved.Lyric.TranslationSeparator
	if resolved.Interactive != nil {
		options.Interactive = *resolved.Interactive
	}
	if resolved.Cover != nil {
		options.Cover = *resolved.Cover
	}
	return options, nil
}

func (options Options) isInteractive() bool {
	return options.Interactive && !options.NoInteractive
}
