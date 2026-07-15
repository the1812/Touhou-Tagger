package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

type AlbumOptions struct {
	DefaultAlbumHint        string   `json:"defaultAlbumHint,omitempty"`
	Source                  string   `json:"source,omitempty"`
	Interactive             *bool    `json:"interactive,omitempty"`
	Cover                   *bool    `json:"cover,omitempty"`
	Lyric                   *bool    `json:"lyric,omitempty"`
	LyricType               string   `json:"lyricType,omitempty"`
	LyricOutput             string   `json:"lyricOutput,omitempty"`
	LyricTime               *bool    `json:"lyricTime,omitempty"`
	LyricCacheSize          int      `json:"lyricCacheSize,omitempty"`
	TranslationSeparator    string   `json:"translationSeparator,omitempty"`
	CommentLanguage         string   `json:"commentLanguage,omitempty"`
	CoverCompressSize       *float64 `json:"coverCompressSize,omitempty"`
	CoverCompressResolution *int     `json:"coverCompressResolution,omitempty"`
	Separator               string   `json:"separator,omitempty"`
	Timeout                 int      `json:"timeout,omitempty"`
	Retry                   int      `json:"retry,omitempty"`
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
