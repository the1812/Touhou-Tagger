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

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

type DumpOptions struct {
	Cover      bool
	Debug      bool
	OutputPath string
}

func (service *Service) DumpMetadata(
	ctx context.Context,
	scan domain.AlbumScan,
	options DumpOptions,
) ([]domain.Metadata, error) {
	dump, err := service.ReadDump(ctx, scan, options.Debug)
	if err != nil {
		return nil, err
	}
	if err := service.saveDump(ctx, scan, dump, options); err != nil {
		return nil, err
	}
	return dump.Metadata, nil
}

func (service *Service) saveDump(ctx context.Context, scan domain.AlbumScan, dump MetadataDump, options DumpOptions) error {
	if len(scan.AudioFiles) == 0 {
		return fmt.Errorf("%w in %q", domain.ErrNoAudio, scan.Directory)
	}
	output := options.OutputPath
	if output == "" {
		output = filepath.Join(scan.Directory, "metadata.json")
	}
	for _, audio := range scan.AudioFiles {
		if normalizedPath(output) == normalizedPath(audio.Path) {
			return fmt.Errorf("metadata output cannot replace audio file %q", audio.Path)
		}
	}
	expected, err := captureOwnedFile(output)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("inspect metadata output %q: %w", output, err)
	}
	cover := dump.Cover()
	var coverPath string
	var coverState ownedFileState
	if options.Cover && len(cover) > 0 {
		coverPath, err = CoverPath(filepath.Dir(output), cover)
		if err != nil {
			return err
		}
		if normalizedPath(output) == normalizedPath(coverPath) {
			return fmt.Errorf("metadata and cover output paths must differ: %q", output)
		}
		coverState, err = captureOwnedFile(coverPath)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	if err := writeDumpFile(ctx, output, dump.JSON, expected); err != nil {
		return fmt.Errorf("write metadata.json: %w", err)
	}
	if options.Debug {
		data, err := json.MarshalIndent(dump.Raw, "", "  ")
		if err != nil {
			return fmt.Errorf("encode metadata.debug.json: %w", err)
		}
		if err := os.WriteFile(filepath.Join(scan.Directory, "metadata.debug.json"), data, 0o644); err != nil {
			return fmt.Errorf("write metadata.debug.json: %w", err)
		}
	}
	if coverPath != "" {
		if err := writeDumpFile(ctx, coverPath, cover, coverState); err != nil {
			return err
		}
	}
	if err := service.emit(domain.ProgressEvent{
		Stage:     domain.StageComplete,
		Directory: scan.Directory,
		Current:   len(dump.Metadata),
		Total:     len(dump.Metadata),
	}); err != nil {
		return err
	}
	return nil
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
