package application

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	albumfs "github.com/the1812/Touhou-Tagger/go/internal/filesystem"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

type EventSink func(domain.ProgressEvent) error

type Service struct {
	Sources source.Registry
	Readers tagio.Readers
	Writers tagio.Writers
	Config  domain.MetadataConfig
	Events  EventSink
}

type AlbumMetadata struct {
	Metadata    []domain.Metadata
	Cover       []byte
	CoverSource string
}

func (service *Service) ScanAlbum(
	ctx context.Context,
	directory string,
) (domain.AlbumScan, error) {
	if err := service.emit(domain.ProgressEvent{Stage: domain.StageScan, Directory: directory}); err != nil {
		return domain.AlbumScan{}, err
	}
	return albumfs.ScanAlbum(ctx, directory)
}

func (service *Service) SearchCandidates(
	ctx context.Context,
	query string,
	sourceName string,
) ([]domain.AlbumCandidate, error) {
	metadataSource, exists := service.Sources[sourceName]
	if !exists {
		return nil, fmt.Errorf("metadata source %q is not registered", sourceName)
	}
	if err := service.emit(domain.ProgressEvent{Stage: domain.StageSearch, Message: query}); err != nil {
		return nil, err
	}
	return withRetry(ctx, service.Config, func(attemptContext context.Context) ([]domain.AlbumCandidate, error) {
		return metadataSource.SearchCandidates(attemptContext, query)
	})
}

func (service *Service) GetAlbumMetadata(
	ctx context.Context,
	scan domain.AlbumScan,
	candidate domain.AlbumCandidate,
) (AlbumMetadata, error) {
	if len(scan.AudioFiles) == 0 {
		return AlbumMetadata{}, fmt.Errorf("%w in %q", domain.ErrNoAudio, scan.Directory)
	}
	var cover []byte
	if scan.CoverPath != "" {
		var err error
		cover, err = os.ReadFile(scan.CoverPath)
		if err != nil {
			return AlbumMetadata{}, fmt.Errorf("read local cover %q: %w", scan.CoverPath, err)
		}
	}
	metadataSourceName := candidate.Source
	metadataID := candidate.ID
	if scan.MetadataPath != "" {
		metadataSourceName = "local-json"
		metadataID = scan.MetadataPath
	}
	metadataSource, exists := service.Sources[metadataSourceName]
	if !exists {
		return AlbumMetadata{}, fmt.Errorf("metadata source %q is not registered", metadataSourceName)
	}
	if err := service.emit(domain.ProgressEvent{Stage: domain.StageFetch, Directory: scan.Directory, Message: metadataID}); err != nil {
		return AlbumMetadata{}, err
	}
	metadata, err := withRetry(
		ctx,
		service.Config,
		func(attemptContext context.Context) ([]domain.Metadata, error) {
			return metadataSource.GetMetadata(attemptContext, metadataID, cover)
		},
	)
	if err != nil {
		return AlbumMetadata{}, err
	}
	coverSource := "local"
	if len(cover) == 0 {
		coverSource = metadataSourceName
		if len(metadata) > 0 {
			cover = metadata[0].CoverImage
		}
	}
	return AlbumMetadata{Metadata: metadata, Cover: cover, CoverSource: coverSource}, nil
}

func (service *Service) emit(event domain.ProgressEvent) error {
	if service.Events != nil {
		if err := service.Events(event); err != nil {
			return fmt.Errorf("emit %s progress: %w", event.Stage, err)
		}
	}
	return nil
}

func withRetry[T any](
	ctx context.Context,
	config domain.MetadataConfig,
	action func(context.Context) (T, error),
) (T, error) {
	var zero T
	attempts := config.Retry
	if attempts < 1 {
		attempts = 1
	}
	timeout := time.Duration(config.Timeout) * time.Second
	var failures []error
	for attempt := 1; attempt <= attempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return zero, err
		}
		attemptContext := ctx
		cancel := func() {}
		if timeout > 0 {
			attemptContext, cancel = context.WithTimeout(ctx, timeout)
		}
		value, err := action(attemptContext)
		timedOut := errors.Is(attemptContext.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded)
		cancel()
		if err == nil {
			return value, nil
		}
		failures = append(failures, fmt.Errorf("attempt %d: %w", attempt, err))
		if !timedOut {
			return zero, err
		}
	}
	return zero, fmt.Errorf("operation failed after %d attempts: %w", attempts, errors.Join(failures...))
}
