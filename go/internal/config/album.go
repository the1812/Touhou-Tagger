package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type AlbumOverrides struct {
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

type RuntimeAlbumOptions struct {
	Metadata         domain.MetadataConfig
	DefaultAlbumHint string
	Interactive      bool
	Cover            bool
}

func LoadAlbum(directory string) (AlbumOverrides, error) {
	data, err := os.ReadFile(filepath.Join(directory, "thtag.json"))
	if errors.Is(err, os.ErrNotExist) {
		return AlbumOverrides{}, nil
	}
	if err != nil {
		return AlbumOverrides{}, fmt.Errorf("read album config: %w", err)
	}
	var value AlbumOverrides
	if err := json.Unmarshal(data, &value); err != nil {
		return AlbumOverrides{}, &domain.ParseError{Kind: domain.ConfigData, Err: fmt.Errorf("parse album config: %w", err)}
	}
	return value, nil
}

func ResolveAlbum(
	directory string,
	base RuntimeAlbumOptions,
) (RuntimeAlbumOptions, error) {
	album, err := LoadAlbum(directory)
	if err != nil {
		return RuntimeAlbumOptions{}, err
	}
	metadata := base.Metadata
	lyric := domain.DefaultLyricConfig()
	if metadata.Lyric != nil {
		lyric = *metadata.Lyric
	}
	if album.Source != nil {
		metadata.Source = *album.Source
	}
	if album.Lyric != nil {
		metadata.LyricEnabled = *album.Lyric
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
		metadata.CommentLanguage = *album.CommentLanguage
	}
	if album.CoverCompressSize != nil {
		metadata.CoverCompressSize = *album.CoverCompressSize
	}
	if album.CoverCompressResolution != nil {
		metadata.CoverCompressResolution = *album.CoverCompressResolution
	}
	if album.Separator != nil {
		metadata.Separator = *album.Separator
	}
	if album.Timeout != nil {
		metadata.Timeout = *album.Timeout
	}
	if album.Retry != nil {
		metadata.Retry = *album.Retry
	}
	metadata.Lyric = &lyric
	if err := ValidateMetadata(metadata); err != nil {
		return RuntimeAlbumOptions{}, fmt.Errorf("validate album config: %w", err)
	}
	base.Metadata = metadata
	if album.DefaultAlbumHint != "" {
		base.DefaultAlbumHint = album.DefaultAlbumHint
	}
	if album.Interactive != nil {
		base.Interactive = *album.Interactive
	}
	if album.Cover != nil {
		base.Cover = *album.Cover
	}
	return base, nil
}

func SaveAlbumSelection(directory, source, hint string) error {
	path := filepath.Join(directory, "thtag.json")
	data, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read album config: %w", err)
	}
	value := make(map[string]json.RawMessage)
	if err == nil {
		if err := json.Unmarshal(data, &value); err != nil {
			return &domain.ParseError{Kind: domain.ConfigData, Err: fmt.Errorf("parse album config: %w", err)}
		}
	}
	changed := false
	if source == "" {
		if _, exists := value["source"]; exists {
			delete(value, "source")
			changed = true
		}
	} else {
		sourceData, err := json.Marshal(source)
		if err != nil {
			return fmt.Errorf("encode album source: %w", err)
		}
		if !bytes.Equal(value["source"], sourceData) {
			value["source"] = sourceData
			changed = true
		}
	}
	if hint != "" {
		hintData, err := json.Marshal(hint)
		if err != nil {
			return fmt.Errorf("encode default album hint: %w", err)
		}
		if !bytes.Equal(value["defaultAlbumHint"], hintData) {
			value["defaultAlbumHint"] = hintData
			changed = true
		}
	}
	if !changed {
		return nil
	}
	if len(value) == 0 {
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("remove empty album config: %w", err)
		}
		return nil
	}
	data, err = json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode album config: %w", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write album config: %w", err)
	}
	return nil
}
