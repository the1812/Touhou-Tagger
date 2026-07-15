package application

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
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

func (service *Service) ScanAlbum(
	ctx context.Context,
	directory string,
) (domain.AlbumScan, error) {
	if err := service.emit(domain.ProgressEvent{Stage: domain.StageScan, Directory: directory}); err != nil {
		return domain.AlbumScan{}, err
	}
	return albumfs.ScanAlbum(ctx, directory)
}

func (service *Service) SearchAlbums(
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
		return metadataSource.Search(attemptContext, query)
	})
}

func (service *Service) BuildTagPlan(
	ctx context.Context,
	directory string,
	candidate domain.AlbumCandidate,
) (domain.TagPlan, []byte, error) {
	scan, err := service.ScanAlbum(ctx, directory)
	if err != nil {
		return domain.TagPlan{}, nil, err
	}
	if len(scan.AudioFiles) == 0 {
		return domain.TagPlan{}, nil, fmt.Errorf("no supported audio files found in %q", scan.Directory)
	}
	var cover []byte
	if scan.CoverPath != "" {
		cover, err = os.ReadFile(scan.CoverPath)
		if err != nil {
			return domain.TagPlan{}, nil, fmt.Errorf("read local cover %q: %w", scan.CoverPath, err)
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
		return domain.TagPlan{}, nil, fmt.Errorf("metadata source %q is not registered", metadataSourceName)
	}
	if err := service.emit(domain.ProgressEvent{Stage: domain.StageFetch, Directory: scan.Directory, Message: metadataID}); err != nil {
		return domain.TagPlan{}, nil, err
	}
	metadata, err := withRetry(ctx, service.Config, func(attemptContext context.Context) ([]domain.Metadata, error) {
		return metadataSource.Fetch(attemptContext, metadataID, cover)
	})
	if err != nil {
		return domain.TagPlan{}, nil, err
	}
	plan, err := BuildTagPlan(scan, metadata)
	if err != nil {
		return domain.TagPlan{}, nil, err
	}
	if err := service.emit(domain.ProgressEvent{Stage: domain.StagePlan, Directory: scan.Directory, Total: len(plan.Items)}); err != nil {
		return domain.TagPlan{}, nil, err
	}
	return plan, cover, nil
}

func (service *Service) ApplyTagPlan(ctx context.Context, plan domain.TagPlan) error {
	if len(plan.Items) == 0 {
		return fmt.Errorf("tag plan for %q is empty", plan.Directory)
	}
	prepared := make([]preparedWrite, 0, len(plan.Items))
	for index, item := range plan.Items {
		if err := ctx.Err(); err != nil {
			return errors.Join(err, cleanupPrepared(prepared))
		}
		writer, exists := service.Writers[item.Format]
		if !exists {
			return errors.Join(
				fmt.Errorf("no tag writer registered for %s file %q", item.Format, item.SourcePath),
				cleanupPrepared(prepared),
			)
		}
		temporary, err := copyToTemporary(ctx, item.SourcePath, ".thtag-write-*")
		if err != nil {
			return errors.Join(err, cleanupPrepared(prepared))
		}
		prepared = append(prepared, preparedWrite{item: item, temporary: temporary})
		if err := writer.Write(ctx, temporary, item.Metadata, service.Config); err != nil {
			return errors.Join(
				fmt.Errorf("write metadata to %q: %w", item.SourcePath, err),
				cleanupPrepared(prepared),
			)
		}
		if err := service.emit(domain.ProgressEvent{
			Stage: domain.StageWrite, Directory: plan.Directory, Path: item.SourcePath,
			Current: index + 1, Total: len(plan.Items),
		}); err != nil {
			return errors.Join(err, cleanupPrepared(prepared))
		}
	}
	if err := service.emit(domain.ProgressEvent{
		Stage: domain.StageRename, Directory: plan.Directory, Total: len(plan.Items),
	}); err != nil {
		return errors.Join(err, cleanupPrepared(prepared))
	}
	if err := replaceOriginals(prepared); err != nil {
		return errors.Join(err, cleanupPrepared(prepared))
	}
	if err := renameTwoPhase(plan.Items); err != nil {
		return err
	}
	if service.Config.Lyric != nil && service.Config.Lyric.Output == domain.LyricLRC {
		for _, item := range plan.Items {
			if item.Metadata.Lyric == "" {
				continue
			}
			lyricPath := item.TargetPath[:len(item.TargetPath)-len(filepath.Ext(item.TargetPath))] + ".lrc"
			if err := atomicWrite(lyricPath, []byte(item.Metadata.Lyric), 0o644); err != nil {
				return fmt.Errorf("write LRC %q: %w", lyricPath, err)
			}
		}
	}
	return service.emit(domain.ProgressEvent{
		Stage: domain.StageComplete, Directory: plan.Directory, Total: len(plan.Items),
	})
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
		cancel()
		if err == nil {
			return value, nil
		}
		failures = append(failures, fmt.Errorf("attempt %d: %w", attempt, err))
	}
	return zero, fmt.Errorf("operation failed after %d attempts: %w", attempts, errors.Join(failures...))
}
