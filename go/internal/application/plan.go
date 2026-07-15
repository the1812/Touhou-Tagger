package application

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func BuildTagPlan(scan domain.AlbumScan, metadata []domain.Metadata) (domain.TagPlan, error) {
	metadata = domain.ExpandMetadata(metadata, nil)
	if len(scan.AudioFiles) != len(metadata) {
		return domain.TagPlan{}, fmt.Errorf(
			"track count mismatch in %q: found %d audio files but metadata contains %d tracks",
			scan.Directory, len(scan.AudioFiles), len(metadata),
		)
	}
	width := int(math.Log10(float64(max(len(metadata), 1)))) + 1
	if width < 2 {
		width = 2
	}
	items := make([]domain.TagPlanItem, len(metadata))
	sourcePaths := make(map[string]struct{}, len(scan.AudioFiles))
	for _, audio := range scan.AudioFiles {
		sourcePaths[pathKey(audio.Path)] = struct{}{}
	}
	targetPaths := make(map[string]string, len(metadata))
	for index, track := range metadata {
		audio := scan.AudioFiles[index]
		baseName := fmt.Sprintf("%0*s %s%s", width, track.TrackNumber, track.Title, filepath.Ext(audio.Path))
		baseName = sanitizeFilename(baseName)
		if baseName == "" || baseName == filepath.Ext(audio.Path) {
			return domain.TagPlan{}, fmt.Errorf("track %d produces an empty target filename", index+1)
		}
		target := filepath.Join(filepath.Dir(audio.Path), baseName)
		key := pathKey(target)
		if previous, exists := targetPaths[key]; exists {
			return domain.TagPlan{}, fmt.Errorf("target filename conflict: %q and %q", previous, target)
		}
		targetPaths[key] = target
		if _, sourceTarget := sourcePaths[key]; !sourceTarget {
			if _, err := os.Stat(target); err == nil {
				return domain.TagPlan{}, fmt.Errorf("target file already exists: %q", target)
			} else if !os.IsNotExist(err) {
				return domain.TagPlan{}, fmt.Errorf("inspect target file %q: %w", target, err)
			}
		}
		items[index] = domain.TagPlanItem{
			SourcePath: audio.Path,
			TargetPath: target,
			Format:     audio.Format,
			Metadata:   track,
		}
	}
	return domain.TagPlan{Directory: scan.Directory, Items: items}, nil
}

func sanitizeFilename(value string) string {
	value = strings.Map(func(character rune) rune {
		switch character {
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			return -1
		default:
			return character
		}
	}, value)
	value = strings.TrimRight(value, ". ")
	if !utf8.ValidString(value) {
		return ""
	}
	return value
}

func pathKey(path string) string {
	return strings.ToLower(normalizedPath(path))
}

func normalizedPath(path string) string {
	cleaned, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		cleaned = filepath.Clean(path)
	}
	return cleaned
}
