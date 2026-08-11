package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func Path() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home: %w", err)
	}
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("APPDATA")
		if base == "" {
			base = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(base, "Touhou Tagger", "config.json"), nil
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Touhou Tagger", "config.json"), nil
	default:
		base := os.Getenv("XDG_CONFIG_HOME")
		if base == "" {
			base = filepath.Join(home, ".config")
		}
		return filepath.Join(base, "touhou-tagger", "config.json"), nil
	}
}

func Load() (domain.MetadataConfig, error) {
	defaults := domain.DefaultMetadataConfig()
	path, err := Path()
	if err != nil {
		return defaults, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil {
			return defaults, fmt.Errorf("resolve legacy config path: %w", homeErr)
		}
		data, err = os.ReadFile(filepath.Join(home, ".thtag.json"))
	}
	if errors.Is(err, os.ErrNotExist) {
		return defaults, nil
	}
	if err != nil {
		return defaults, fmt.Errorf("read config: %w", err)
	}
	if err := json.Unmarshal(data, &defaults); err != nil {
		return defaults, fmt.Errorf("parse config: %w", err)
	}
	applyDefaults(&defaults)
	return defaults, nil
}

func Save(value domain.MetadataConfig) (resultErr error) {
	path, err := Path()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}
	if err := writeFileAtomic(path, data, 0o600); err != nil {
		return fmt.Errorf("replace config: %w", err)
	}
	return nil
}

func writeFileAtomic(path string, data []byte, mode os.FileMode) (resultErr error) {
	temporary, err := os.CreateTemp(filepath.Dir(path), ".config-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	temporaryPath := temporary.Name()
	closed := false
	defer func() {
		if !closed {
			resultErr = errors.Join(resultErr, temporary.Close())
		}
		if removeErr := os.Remove(temporaryPath); removeErr != nil && !os.IsNotExist(removeErr) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary file: %w", removeErr))
		}
	}()
	if err := temporary.Chmod(mode); err != nil {
		return fmt.Errorf("set temporary file mode: %w", err)
	}
	if _, err := temporary.Write(data); err != nil {
		return fmt.Errorf("write temporary file: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("flush temporary file: %w", err)
	}
	if err := temporary.Close(); err != nil {
		closed = true
		return fmt.Errorf("close temporary file: %w", err)
	}
	closed = true
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("replace file: %w", err)
	}
	return nil
}

func applyDefaults(value *domain.MetadataConfig) {
	defaults := domain.DefaultMetadataConfig()
	if value.Source == "" {
		value.Source = defaults.Source
	}
	if value.CommentLanguage == "" {
		value.CommentLanguage = defaults.CommentLanguage
	}
	if value.Separator == "" {
		value.Separator = defaults.Separator
	}
	if value.Timeout <= 0 {
		value.Timeout = defaults.Timeout
	}
	if value.Retry <= 0 {
		value.Retry = defaults.Retry
	}
	lyricDefaults := domain.DefaultLyricConfig()
	if value.Lyric == nil {
		value.Lyric = &lyricDefaults
	} else {
		if value.Lyric.Type == "" {
			value.Lyric.Type = lyricDefaults.Type
		}
		if value.Lyric.Output == "" {
			value.Lyric.Output = lyricDefaults.Output
		}
		if value.Lyric.TranslationSeparator == "" {
			value.Lyric.TranslationSeparator = lyricDefaults.TranslationSeparator
		}
		if value.Lyric.MaxCacheSize <= 0 {
			value.Lyric.MaxCacheSize = lyricDefaults.MaxCacheSize
		}
	}
}

func ValidateMetadata(value domain.MetadataConfig) error {
	if len(value.CommentLanguage) != 3 {
		return fmt.Errorf("comment language must be a three-letter ISO-639-2 code")
	}
	if value.CoverCompressSize < 0 || value.CoverCompressResolution < 0 {
		return fmt.Errorf("cover compression limits must not be negative")
	}
	if strings.TrimSpace(value.Separator) == "" {
		return fmt.Errorf("metadata separator must not be empty")
	}
	if value.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}
	if value.Retry <= 0 {
		return fmt.Errorf("retry must be positive")
	}
	if value.Lyric == nil && !value.LyricEnabled {
		return nil
	}
	if value.Lyric == nil {
		return fmt.Errorf("lyric preferences are required when lyrics are enabled")
	}
	if value.Lyric.Type != domain.LyricOriginal &&
		value.Lyric.Type != domain.LyricTranslated &&
		value.Lyric.Type != domain.LyricMixed {
		return fmt.Errorf("unsupported lyric type %q", value.Lyric.Type)
	}
	if value.Lyric.Output != domain.LyricMetadata && value.Lyric.Output != domain.LyricLRC {
		return fmt.Errorf("unsupported lyric output %q", value.Lyric.Output)
	}
	if value.Lyric.MaxCacheSize <= 0 {
		return fmt.Errorf("lyric cache size must be positive")
	}
	if strings.TrimSpace(value.Lyric.TranslationSeparator) == "" {
		return fmt.Errorf("lyric translation separator must not be empty")
	}
	return nil
}

func RuntimeMetadata(value domain.MetadataConfig) domain.MetadataConfig {
	if !value.LyricEnabled {
		value.Lyric = nil
	}
	return value
}
