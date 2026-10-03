package application

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

var albumNameFormats = []*regexp.Regexp{
	regexp.MustCompile(`^\d{4}\.\d{2}\.\d{2} \[.+?\] (.+?)( \[.+?\])?$`),
	regexp.MustCompile(`^\d{4}\.\d{2}\.\d{2} (.+?)( \[.+?\])?$`),
	regexp.MustCompile(`^(.+?) \[.+?\]$`),
}

func (service *Service) ScanBatch(
	ctx context.Context,
	directory string,
	depth int,
) ([]domain.BatchScanEntry, error) {
	if depth < 1 {
		return nil, fmt.Errorf("batch depth must be at least 1")
	}
	absolute, err := filepath.Abs(directory)
	if err != nil {
		return nil, fmt.Errorf("resolve batch directory: %w", err)
	}
	directories, err := directoriesAtDepth(ctx, absolute, depth)
	if err != nil {
		return nil, err
	}
	entries := make([]domain.BatchScanEntry, 0, len(directories))
	for _, albumDirectory := range directories {
		scan, err := service.ScanAlbum(ctx, albumDirectory)
		if err != nil {
			entries = append(entries, domain.BatchScanEntry{
				Directory: albumDirectory,
				Name:      filepath.Base(albumDirectory),
				PreflightErr: fmt.Errorf(
					"scan album %q: %w", albumDirectory, err,
				),
			})
			continue
		}
		if len(scan.AudioFiles) == 0 {
			entries = append(entries, domain.BatchScanEntry{
				Directory: albumDirectory,
				Name:      filepath.Base(albumDirectory),
				Ignored:   true,
			})
			continue
		}
		name, err := DefaultAlbumName(albumDirectory)
		if err != nil {
			entries = append(entries, domain.BatchScanEntry{
				Directory:    albumDirectory,
				Name:         filepath.Base(albumDirectory),
				PreflightErr: err,
			})
			continue
		}
		entries = append(entries, domain.BatchScanEntry{
			Directory:  albumDirectory,
			Name:       name,
			AudioCount: len(scan.AudioFiles),
		})
	}
	return entries, nil
}

func (service *Service) RunBatch(
	ctx context.Context,
	entries []domain.BatchScanEntry,
	run func(context.Context, domain.BatchScanEntry) error,
) []domain.BatchResult {
	results := make([]domain.BatchResult, 0, len(entries))
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			results = append(results, domain.BatchResult{Entry: entry, Err: err})
			break
		}
		if entry.PreflightErr != nil {
			results = append(results, domain.BatchResult{Entry: entry, Err: entry.PreflightErr})
			continue
		}
		if entry.Ignored {
			results = append(results, domain.BatchResult{Entry: entry})
			continue
		}
		started := time.Now()
		err := run(ctx, entry)
		results = append(results, domain.BatchResult{
			Entry: entry, Duration: time.Since(started), Err: err,
		})
	}
	return results
}

func DefaultAlbumName(directory string) (string, error) {
	options, err := config.LoadAlbum(directory)
	if err != nil {
		return "", err
	}
	return albumName(directory, options.DefaultAlbumHint), nil
}

func albumName(directory, hint string) string {
	if hint != "" {
		return hint
	}
	name := filepath.Base(filepath.Clean(directory))
	for _, format := range albumNameFormats {
		if match := format.FindStringSubmatch(name); len(match) > 1 {
			return match[1]
		}
	}
	return name
}

func directoriesAtDepth(ctx context.Context, directory string, depth int) ([]string, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, fmt.Errorf("read batch directory %q: %w", directory, err)
	}
	result := make([]string, 0)
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if !entry.IsDir() {
			continue
		}
		path := filepath.Join(directory, entry.Name())
		if depth == 1 {
			result = append(result, path)
			continue
		}
		nested, err := directoriesAtDepth(ctx, path, depth-1)
		if err != nil {
			return nil, err
		}
		result = append(result, nested...)
	}
	return result, nil
}
