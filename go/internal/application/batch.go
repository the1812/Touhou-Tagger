package application

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

var datedAlbumName = regexp.MustCompile(`^\d{4}\.\d{2}\.\d{2} (.+?) \[.+?\]$`)

func (service *Service) ScanBatch(
	ctx context.Context,
	directory string,
	depth int,
) ([]domain.BatchJob, error) {
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
	jobs := make([]domain.BatchJob, 0, len(directories))
	for _, albumDirectory := range directories {
		scan, err := service.ScanAlbum(ctx, albumDirectory)
		if err != nil {
			jobs = append(jobs, domain.BatchJob{
				Directory: albumDirectory,
				Name:      filepath.Base(albumDirectory),
				PreflightErr: fmt.Errorf(
					"scan album %q: %w", albumDirectory, err,
				),
			})
			continue
		}
		if len(scan.AudioFiles) == 0 {
			jobs = append(jobs, domain.BatchJob{
				Directory: albumDirectory,
				Name:      filepath.Base(albumDirectory),
				Ignored:   true,
			})
			continue
		}
		name, err := DefaultAlbumName(albumDirectory)
		if err != nil {
			jobs = append(jobs, domain.BatchJob{
				Directory:    albumDirectory,
				Name:         filepath.Base(albumDirectory),
				PreflightErr: err,
			})
			continue
		}
		jobs = append(jobs, domain.BatchJob{Directory: albumDirectory, Name: name})
	}
	return jobs, nil
}

func (service *Service) RunBatch(
	ctx context.Context,
	jobs []domain.BatchJob,
	run func(context.Context, domain.BatchJob) error,
) []domain.BatchResult {
	results := make([]domain.BatchResult, 0, len(jobs))
	for _, job := range jobs {
		if err := ctx.Err(); err != nil {
			results = append(results, domain.BatchResult{Job: job, Err: err})
			break
		}
		if job.PreflightErr != nil {
			results = append(results, domain.BatchResult{Job: job, Err: job.PreflightErr})
			continue
		}
		if job.Ignored {
			results = append(results, domain.BatchResult{Job: job})
			continue
		}
		started := time.Now()
		err := run(ctx, job)
		results = append(results, domain.BatchResult{
			Job: job, Duration: time.Since(started), Err: err,
		})
	}
	return results
}

func DefaultAlbumName(directory string) (string, error) {
	options, err := config.LoadAlbum(directory)
	if err != nil {
		return "", err
	}
	if options.DefaultAlbumHint != "" {
		return options.DefaultAlbumHint, nil
	}
	name := filepath.Base(filepath.Clean(directory))
	if match := datedAlbumName.FindStringSubmatch(name); len(match) > 1 {
		return match[1], nil
	}
	if before, _, found := strings.Cut(name, " [Disc "); found {
		return before, nil
	}
	return name, nil
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
