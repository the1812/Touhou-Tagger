package application

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

type DumpOptions struct {
	Cover bool
	Debug bool
}

func (service *Service) DumpMetadata(
	ctx context.Context,
	scan domain.AlbumScan,
	options DumpOptions,
) ([]domain.Metadata, error) {
	if len(scan.AudioFiles) == 0 {
		return nil, fmt.Errorf("%w in %q", domain.ErrNoAudio, scan.Directory)
	}
	scan.AudioFiles = slices.Clone(scan.AudioFiles)
	slices.SortFunc(scan.AudioFiles, func(left, right domain.AudioFile) int {
		return strings.Compare(filepath.ToSlash(left.Path), filepath.ToSlash(right.Path))
	})
	metadata := make([]domain.Metadata, len(scan.AudioFiles))
	var rawTags []any
	if options.Debug {
		rawTags = make([]any, len(scan.AudioFiles))
	}
	err := processFiles(ctx, len(scan.AudioFiles), func(index int) error {
		audio := scan.AudioFiles[index]
		reader, exists := service.Readers[audio.Format]
		if !exists {
			return fmt.Errorf("%w: no tag reader registered for %s file %q", domain.ErrUnsupportedFormat, audio.Format, audio.Path)
		}
		result, err := reader.Read(ctx, audio.Path, service.Config, tagio.ReadOptions{IncludeRaw: options.Debug})
		if err != nil {
			return fmt.Errorf("read metadata from %q: %w", audio.Path, err)
		}
		metadata[index] = result.Metadata
		if options.Debug {
			rawTags[index] = result.Raw
		}
		return nil
	}, func(index, completed int) error {
		return service.emit(domain.ProgressEvent{
			Stage: domain.StageWrite, Directory: scan.Directory, Path: scan.AudioFiles[index].Path,
			Current: completed, Total: len(scan.AudioFiles), Message: "read metadata",
		})
	})
	if err != nil {
		return nil, err
	}
	var cover []byte
	for _, item := range metadata {
		if len(item.CoverImage) > 0 {
			cover = item.CoverImage
			break
		}
	}
	simplified := domain.SimplifyMetadata(metadata)
	serializable := make([]domain.Metadata, len(simplified))
	for index, item := range simplified {
		serializable[index] = item.WithoutCover()
	}
	data, err := json.MarshalIndent(serializable, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode metadata.json: %w", err)
	}
	if err := os.WriteFile(filepath.Join(scan.Directory, "metadata.json"), data, 0o644); err != nil {
		return nil, fmt.Errorf("write metadata.json: %w", err)
	}
	if options.Debug {
		data, err := json.MarshalIndent(rawTags, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("encode metadata.debug.json: %w", err)
		}
		if err := os.WriteFile(filepath.Join(scan.Directory, "metadata.debug.json"), data, 0o644); err != nil {
			return nil, fmt.Errorf("write metadata.debug.json: %w", err)
		}
	}
	if options.Cover && len(cover) > 0 {
		if _, err := SaveCover(scan.Directory, cover); err != nil {
			return nil, err
		}
	}
	if err := service.emit(domain.ProgressEvent{
		Stage:     domain.StageComplete,
		Directory: scan.Directory,
		Current:   len(metadata),
		Total:     len(metadata),
	}); err != nil {
		return nil, err
	}
	return metadata, nil
}

func SaveCover(directory string, cover []byte) (string, error) {
	path, err := CoverPath(directory, cover)
	if err != nil {
		return "", err
	}
	return SaveCoverAt(path, cover)
}

func SaveCoverAt(path string, cover []byte) (string, error) {
	if err := os.WriteFile(path, cover, 0o644); err != nil {
		return "", fmt.Errorf("write cover %q: %w", path, err)
	}
	return path, nil
}

func SaveCoverNew(directory string, cover []byte) (string, error) {
	path, err := CoverPath(directory, cover)
	if err != nil {
		return "", err
	}
	if err := writeNewFile(path, cover, 0o644); err != nil {
		return "", fmt.Errorf("write new cover %q: %w", path, err)
	}
	return path, nil
}

func CoverPath(directory string, cover []byte) (string, error) {
	_, format, err := image.DecodeConfig(bytes.NewReader(cover))
	if err != nil {
		return "", fmt.Errorf("detect cover image format: %w", err)
	}
	if format == "jpeg" {
		format = "jpg"
	}
	return filepath.Join(directory, "cover."+format), nil
}
