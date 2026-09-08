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
	"path/filepath"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

func (service *Service) DumpMetadata(
	ctx context.Context,
	directory string,
	writeCover bool,
) ([]domain.Metadata, error) {
	scan, err := service.ScanAlbum(ctx, directory)
	if err != nil {
		return nil, err
	}
	if len(scan.AudioFiles) == 0 {
		return nil, fmt.Errorf("%w in %q", domain.ErrNoAudio, scan.Directory)
	}
	metadata := make([]domain.Metadata, len(scan.AudioFiles))
	var cover []byte
	for index, audio := range scan.AudioFiles {
		reader, exists := service.Readers[audio.Format]
		if !exists {
			return nil, fmt.Errorf("%w: no tag reader registered for %s file %q", domain.ErrUnsupportedFormat, audio.Format, audio.Path)
		}
		item, err := reader.Read(ctx, audio.Path, service.Config)
		if err != nil {
			return nil, fmt.Errorf("read metadata from %q: %w", audio.Path, err)
		}
		metadata[index] = item
		if len(cover) == 0 && len(item.CoverImage) > 0 {
			cover = append([]byte(nil), item.CoverImage...)
		}
		if err := service.emit(domain.ProgressEvent{
			Stage: domain.StageWrite, Directory: scan.Directory, Path: audio.Path,
			Current: index + 1, Total: len(scan.AudioFiles), Message: "read metadata",
		}); err != nil {
			return nil, err
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
	if err := atomicWrite(filepath.Join(scan.Directory, "metadata.json"), data, 0o644); err != nil {
		return nil, fmt.Errorf("write metadata.json: %w", err)
	}
	if writeCover && len(cover) > 0 {
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
	if err := atomicWrite(path, cover, 0o644); err != nil {
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
