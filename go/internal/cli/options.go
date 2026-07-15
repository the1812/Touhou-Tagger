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
		Source:                  "thb-wiki",
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
	value := domain.MetadataConfig{
		CommentLanguage:         options.CommentLanguage,
		CoverCompressSize:       options.CoverCompressSize,
		CoverCompressResolution: options.CoverCompressResolution,
		Separator:               options.Separator,
		Timeout:                 options.Timeout,
		Retry:                   options.Retry,
	}
	if options.Lyric {
		value.Lyric = options.lyricConfig()
	}
	return value
}

func (options Options) persistedConfig() domain.MetadataConfig {
	value := options.metadataConfig()
	value.Lyric = options.lyricConfig()
	return value
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
	album, err := config.LoadAlbum(directory)
	if err != nil {
		return Options{}, err
	}
	if album.Source != "" {
		options.Source = album.Source
	}
	if album.Interactive != nil {
		options.Interactive = *album.Interactive
	}
	if album.Cover != nil {
		options.Cover = *album.Cover
	}
	if album.Lyric != nil {
		options.Lyric = *album.Lyric
	}
	if album.LyricType != "" {
		options.LyricType = album.LyricType
	}
	if album.LyricOutput != "" {
		options.LyricOutput = album.LyricOutput
	}
	if album.LyricTime != nil {
		options.LyricTime = *album.LyricTime
	}
	if album.LyricCacheSize > 0 {
		options.LyricCacheSize = album.LyricCacheSize
	}
	if album.TranslationSeparator != "" {
		options.TranslationSeparator = album.TranslationSeparator
	}
	if album.CommentLanguage != "" {
		options.CommentLanguage = album.CommentLanguage
	}
	if album.CoverCompressSize != nil {
		options.CoverCompressSize = *album.CoverCompressSize
	}
	if album.CoverCompressResolution != nil {
		options.CoverCompressResolution = *album.CoverCompressResolution
	}
	if album.Separator != "" {
		options.Separator = album.Separator
	}
	if album.Timeout > 0 {
		options.Timeout = album.Timeout
	}
	if album.Retry > 0 {
		options.Retry = album.Retry
	}
	return options, nil
}

func (options Options) isInteractive() bool {
	return options.Interactive && !options.NoInteractive
}
