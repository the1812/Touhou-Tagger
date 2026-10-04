package application

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

type MetadataDump struct {
	Metadata []domain.Metadata
	Raw      []any
	JSON     []byte
}

func (dump MetadataDump) Cover() []byte {
	for _, item := range dump.Metadata {
		if len(item.CoverImage) > 0 {
			return item.CoverImage
		}
	}
	return nil
}

func (service *Service) ReadDump(ctx context.Context, scan domain.AlbumScan, includeRaw bool) (MetadataDump, error) {
	files := slices.Clone(scan.AudioFiles)
	slices.SortFunc(files, func(left, right domain.AudioFile) int {
		return strings.Compare(filepath.ToSlash(left.Path), filepath.ToSlash(right.Path))
	})
	dump := MetadataDump{Metadata: make([]domain.Metadata, len(files))}
	if includeRaw {
		dump.Raw = make([]any, len(files))
	}
	err := processFiles(ctx, len(files), func(index int) error {
		audio := files[index]
		reader, exists := service.Readers[audio.Format]
		if !exists {
			return fmt.Errorf("%w: no tag reader registered for %s file %q", domain.ErrUnsupportedFormat, audio.Format, audio.Path)
		}
		result, err := reader.Read(ctx, audio.Path, service.Config, tagio.ReadOptions{IncludeRaw: includeRaw})
		if err != nil {
			return fmt.Errorf("read metadata from %q: %w", audio.Path, err)
		}
		dump.Metadata[index] = result.Metadata
		if includeRaw {
			dump.Raw[index] = result.Raw
		}
		return nil
	}, func(index, completed int) error {
		return service.emit(domain.ProgressEvent{
			Stage: domain.StageWrite, Directory: scan.Directory, Path: files[index].Path,
			Current: completed, Total: len(files), Message: "read metadata",
		})
	})
	if err != nil {
		return MetadataDump{}, err
	}
	simplified := domain.SimplifyMetadata(dump.Metadata)
	serializable := make([]domain.Metadata, len(simplified))
	for index, item := range simplified {
		serializable[index] = item.WithoutCover()
	}
	dump.JSON, err = json.MarshalIndent(serializable, "", "  ")
	if err != nil {
		return MetadataDump{}, fmt.Errorf("encode metadata.json: %w", err)
	}
	return dump, nil
}
