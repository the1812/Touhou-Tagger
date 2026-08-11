package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type AlbumOptions struct {
	DefaultAlbumHint        string   `json:"defaultAlbumHint,omitempty"`
	Source                  *string  `json:"source,omitempty"`
	Interactive             *bool    `json:"interactive,omitempty"`
	Cover                   *bool    `json:"cover,omitempty"`
	Lyric                   *bool    `json:"lyric,omitempty"`
	LyricType               *string  `json:"lyricType,omitempty"`
	LyricOutput             *string  `json:"lyricOutput,omitempty"`
	LyricTime               *bool    `json:"lyricTime,omitempty"`
	LyricCacheSize          *int     `json:"lyricCacheSize,omitempty"`
	TranslationSeparator    *string  `json:"translationSeparator,omitempty"`
	CommentLanguage         *string  `json:"commentLanguage,omitempty"`
	CoverCompressSize       *float64 `json:"coverCompressSize,omitempty"`
	CoverCompressResolution *int     `json:"coverCompressResolution,omitempty"`
	Separator               *string  `json:"separator,omitempty"`
	Timeout                 *int     `json:"timeout,omitempty"`
	Retry                   *int     `json:"retry,omitempty"`
}

type ResolvedAlbumConfig struct {
	Metadata         domain.MetadataConfig
	Lyric            domain.LyricConfig
	DefaultAlbumHint string
	Interactive      *bool
	Cover            *bool
}

func LoadAlbum(directory string) (AlbumOptions, error) {
	data, err := os.ReadFile(filepath.Join(directory, "thtag.json"))
	if errors.Is(err, os.ErrNotExist) {
		return AlbumOptions{}, nil
	}
	if err != nil {
		return AlbumOptions{}, fmt.Errorf("read album config: %w", err)
	}
	var value AlbumOptions
	if err := json.Unmarshal(data, &value); err != nil {
		return AlbumOptions{}, fmt.Errorf("parse album config: %w", err)
	}
	return value, nil
}

func ResolveAlbum(
	directory string,
	base domain.MetadataConfig,
	lyricEnabled bool,
) (ResolvedAlbumConfig, error) {
	album, err := LoadAlbum(directory)
	if err != nil {
		return ResolvedAlbumConfig{}, err
	}
	lyric := domain.DefaultLyricConfig()
	if base.Lyric != nil {
		lyric = *base.Lyric
	}
	if album.Source != nil {
		base.Source = *album.Source
	}
	if album.Lyric != nil {
		lyricEnabled = *album.Lyric
	}
	if album.LyricType != nil {
		lyric.Type = domain.LyricType(*album.LyricType)
	}
	if album.LyricOutput != nil {
		lyric.Output = domain.LyricOutput(*album.LyricOutput)
	}
	if album.LyricTime != nil {
		lyric.Time = *album.LyricTime
	}
	if album.LyricCacheSize != nil {
		lyric.MaxCacheSize = *album.LyricCacheSize
	}
	if album.TranslationSeparator != nil {
		lyric.TranslationSeparator = *album.TranslationSeparator
	}
	if album.CommentLanguage != nil {
		base.CommentLanguage = *album.CommentLanguage
	}
	if album.CoverCompressSize != nil {
		base.CoverCompressSize = *album.CoverCompressSize
	}
	if album.CoverCompressResolution != nil {
		base.CoverCompressResolution = *album.CoverCompressResolution
	}
	if album.Separator != nil {
		base.Separator = *album.Separator
	}
	if album.Timeout != nil {
		base.Timeout = *album.Timeout
	}
	if album.Retry != nil {
		base.Retry = *album.Retry
	}
	base.Lyric = &lyric
	base.LyricEnabled = lyricEnabled
	if err := ValidateMetadata(base); err != nil {
		return ResolvedAlbumConfig{}, fmt.Errorf("validate album config: %w", err)
	}
	return ResolvedAlbumConfig{
		Metadata:         base,
		Lyric:            lyric,
		DefaultAlbumHint: album.DefaultAlbumHint,
		Interactive:      album.Interactive,
		Cover:            album.Cover,
	}, nil
}

func SaveDefaultAlbumHint(directory, hint string) error {
	path := filepath.Join(directory, "thtag.json")
	data, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read album config: %w", err)
	}
	value := make(map[string]json.RawMessage)
	if err == nil {
		if err := json.Unmarshal(data, &value); err != nil {
			return fmt.Errorf("parse album config: %w", err)
		}
	}
	hintData, err := json.Marshal(hint)
	if err != nil {
		return fmt.Errorf("encode default album hint: %w", err)
	}
	value["defaultAlbumHint"] = hintData
	data, err = json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode album config: %w", err)
	}
	if err := writeFileAtomic(path, data, 0o644); err != nil {
		return fmt.Errorf("write album config: %w", err)
	}
	return nil
}
