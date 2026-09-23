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

type ProcessWarning struct {
	Err       error
	Message   string
	Directory string
}

type WarningSink func(ProcessWarning) error

type Service struct {
	Sources  source.Registry
	Readers  tagio.Readers
	Writers  tagio.Writers
	Config   domain.MetadataConfig
	Events   EventSink
	Warnings WarningSink
}

type TagData struct {
	Metadata    []domain.Metadata
	Cover       []byte
	CoverSource string
}

type TagFilesChangedError struct {
	Err error
}

func (err *TagFilesChangedError) Error() string {
	return err.Err.Error()
}

func (err *TagFilesChangedError) Unwrap() error {
	return err.Err
}

func TagFilesMayHaveChanged(err error) bool {
	var changed *TagFilesChangedError
	return errors.As(err, &changed)
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
	scan domain.AlbumScan,
	candidate domain.AlbumCandidate,
) (domain.TagPlan, []byte, error) {
	data, err := service.FetchTagData(ctx, scan, candidate)
	if err != nil {
		return domain.TagPlan{}, nil, err
	}
	plan, err := BuildTagPlan(scan, data.Metadata)
	if err != nil {
		return domain.TagPlan{}, nil, err
	}
	if err := service.emit(domain.ProgressEvent{Stage: domain.StagePlan, Directory: scan.Directory, Total: len(plan.Items)}); err != nil {
		return domain.TagPlan{}, nil, err
	}
	return plan, data.Cover, nil
}

func (service *Service) FetchTagData(
	ctx context.Context,
	scan domain.AlbumScan,
	candidate domain.AlbumCandidate,
) (TagData, error) {
	if len(scan.AudioFiles) == 0 {
		return TagData{}, fmt.Errorf("%w in %q", domain.ErrNoAudio, scan.Directory)
	}
	var cover []byte
	if scan.CoverPath != "" {
		var err error
		cover, err = os.ReadFile(scan.CoverPath)
		if err != nil {
			return TagData{}, fmt.Errorf("read local cover %q: %w", scan.CoverPath, err)
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
		return TagData{}, fmt.Errorf("metadata source %q is not registered", metadataSourceName)
	}
	if err := service.emit(domain.ProgressEvent{Stage: domain.StageFetch, Directory: scan.Directory, Message: metadataID}); err != nil {
		return TagData{}, err
	}
	var fallbackMetadata []domain.Metadata
	var partialFetchErr error
	metadata, err := withRetry(
		ctx,
		service.Config,
		func(attemptContext context.Context) ([]domain.Metadata, error) {
			value, fetchErr := metadataSource.Fetch(attemptContext, metadataID, cover)
			var partial *source.PartialFetchError
			if errors.As(fetchErr, &partial) {
				fallbackMetadata = value
				partialFetchErr = fetchErr
			}
			return value, fetchErr
		},
	)
	if err != nil {
		if partialFetchErr == nil || errors.Is(err, context.Canceled) {
			return TagData{}, err
		}
		metadata = fallbackMetadata
		warning := ProcessWarning{
			Err: err,
			Message: fmt.Sprintf(
				"从 %s 下载远程封面失败，已使用无封面继续预览。",
				metadataSourceName,
			),
			Directory: scan.Directory,
		}
		if service.Warnings == nil {
			return TagData{}, fmt.Errorf("%s: %w", warning.Message, warning.Err)
		}
		if warningErr := service.Warnings(warning); warningErr != nil {
			return TagData{}, fmt.Errorf("report process warning: %w", warningErr)
		}
	}
	coverSource := "local"
	if len(cover) == 0 {
		coverSource = metadataSourceName
		if len(metadata) > 0 {
			cover = metadata[0].CoverImage
		}
	}
	return TagData{Metadata: metadata, Cover: cover, CoverSource: coverSource}, nil
}

type TagWriteResult struct {
	Renamed bool
}

func (service *Service) ApplyTagPlan(ctx context.Context, plan domain.TagPlan) (result TagWriteResult, err error) {
	if len(plan.Items) == 0 {
		return result, fmt.Errorf("tag plan for %q is empty", plan.Directory)
	}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if err := ValidateTagPlanOutputs(plan, service.Config); err != nil {
		return result, err
	}
	for _, item := range plan.Items {
		if _, exists := service.Writers[item.Format]; !exists {
			return result, fmt.Errorf("%w: no tag writer registered for %s file %q", domain.ErrUnsupportedFormat, item.Format, item.SourcePath)
		}
	}
	if err := service.emit(domain.ProgressEvent{
		Stage: domain.StageRename, Directory: plan.Directory, Total: len(plan.Items),
	}); err != nil {
		return result, err
	}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if err := renameTwoPhase(plan.Items); err != nil {
		return result, &TagFilesChangedError{Err: err}
	}
	result.Renamed = true
	defer func() {
		if err != nil {
			err = &TagFilesChangedError{Err: err}
		}
	}()
	outputs := TagPlanOutputs(plan, service.Config)
	outputIndex := 0
	for index, item := range plan.Items {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		if err := service.Writers[item.Format].Write(ctx, item.TargetPath, item.Metadata, service.Config); err != nil {
			return result, fmt.Errorf("write metadata to %q: %w", item.TargetPath, err)
		}
		if outputIndex < len(outputs) && outputs[outputIndex].ItemIndex == index {
			output := outputs[outputIndex]
			if err := os.WriteFile(output.Path, []byte(item.Metadata.Lyric), 0o644); err != nil {
				return result, fmt.Errorf("write LRC %q: %w", output.Path, err)
			}
			outputIndex++
		}
		if err := service.emit(domain.ProgressEvent{
			Stage: domain.StageWrite, Directory: plan.Directory, Path: item.TargetPath,
			Current: index + 1, Total: len(plan.Items),
		}); err != nil {
			return result, err
		}
	}
	return result, nil
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
