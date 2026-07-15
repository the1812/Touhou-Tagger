package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func ScanAlbum(ctx context.Context, directory string) (domain.AlbumScan, error) {
	absolute, err := filepath.Abs(directory)
	if err != nil {
		return domain.AlbumScan{}, fmt.Errorf("resolve album directory: %w", err)
	}
	entries, err := os.ReadDir(absolute)
	if err != nil {
		return domain.AlbumScan{}, fmt.Errorf("read album directory %q: %w", absolute, err)
	}
	scan := domain.AlbumScan{Directory: absolute}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return domain.AlbumScan{}, err
		}
		if entry.IsDir() {
			if strings.HasPrefix(strings.ToLower(entry.Name()), "disc ") {
				if err := appendAudioDirectory(ctx, &scan, filepath.Join(absolute, entry.Name())); err != nil {
					return domain.AlbumScan{}, err
				}
			}
			continue
		}
		name := strings.ToLower(entry.Name())
		fullPath := filepath.Join(absolute, entry.Name())
		if format, supported := audioFormat(name); supported {
			scan.AudioFiles = append(scan.AudioFiles, domain.AudioFile{Path: fullPath, Format: format})
		}
		if scan.CoverPath == "" && isCoverName(name) {
			scan.CoverPath = fullPath
		}
		if scan.MetadataPath == "" && (name == "metadata.json" || name == "metadata.jsonc") {
			scan.MetadataPath = fullPath
		}
	}
	relativePaths := make(map[string]string, len(scan.AudioFiles))
	for _, audioFile := range scan.AudioFiles {
		relative, err := filepath.Rel(absolute, audioFile.Path)
		if err != nil {
			return domain.AlbumScan{}, fmt.Errorf("resolve audio path relative to album: %w", err)
		}
		relativePaths[audioFile.Path] = relative
	}
	sort.Slice(scan.AudioFiles, func(left, right int) bool {
		return naturalPathLess(relativePaths[scan.AudioFiles[left].Path], relativePaths[scan.AudioFiles[right].Path])
	})
	return scan, nil
}

func appendAudioDirectory(ctx context.Context, scan *domain.AlbumScan, directory string) error {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return fmt.Errorf("read disc directory %q: %w", directory, err)
	}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		if entry.IsDir() {
			continue
		}
		if format, supported := audioFormat(strings.ToLower(entry.Name())); supported {
			scan.AudioFiles = append(scan.AudioFiles, domain.AudioFile{
				Path: filepath.Join(directory, entry.Name()), Format: format,
			})
		}
	}
	return nil
}

func audioFormat(name string) (domain.AudioFormat, bool) {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".mp3":
		return domain.FormatMP3, true
	case ".flac":
		return domain.FormatFLAC, true
	default:
		return "", false
	}
}

func isCoverName(name string) bool {
	if !strings.HasPrefix(name, "cover.") {
		return false
	}
	switch strings.TrimPrefix(filepath.Ext(name), ".") {
	case "jpg", "jpeg", "jpe", "tif", "tiff", "bmp", "png", "webp", "gif":
		return true
	default:
		return false
	}
}

func naturalPathLess(left, right string) bool {
	leftParts := strings.FieldsFunc(left, func(value rune) bool { return value == '/' || value == '\\' })
	rightParts := strings.FieldsFunc(right, func(value rune) bool { return value == '/' || value == '\\' })
	for index := 0; index < len(leftParts) && index < len(rightParts); index++ {
		leftNumber, leftHasNumber := leadingInteger(leftParts[index])
		rightNumber, rightHasNumber := leadingInteger(rightParts[index])
		if leftHasNumber && rightHasNumber && leftNumber != rightNumber {
			return leftNumber < rightNumber
		}
		comparison := strings.Compare(strings.ToLower(leftParts[index]), strings.ToLower(rightParts[index]))
		if comparison != 0 {
			return comparison < 0
		}
	}
	return len(leftParts) < len(rightParts)
}

func leadingInteger(value string) (int, bool) {
	end := 0
	for end < len(value) && value[end] >= '0' && value[end] <= '9' {
		end++
	}
	if end == 0 {
		return 0, false
	}
	parsed, err := strconv.Atoi(value[:end])
	return parsed, err == nil
}
