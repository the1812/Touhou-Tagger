package application

import (
	"context"
	"fmt"
	"os"
	"slices"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type ExecutionResult struct {
	PathsUpdated bool
	Reusable     bool
	Written      int
	Renamed      int
	CoversSaved  int
	LRCFiles     int
	CoverPath    string
}

func (plan *Plan) Execute(ctx context.Context, events EventSink) (ExecutionResult, error) {
	result := ExecutionResult{Reusable: true}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if err := validatePlanOutputs(plan.preview.Outputs); err != nil {
		return result, err
	}
	if err := plan.tag(ctx, &result, events); err != nil {
		return result, err
	}
	if cover := plan.options.Cover; cover != nil {
		var err error
		if cover.Replace {
			_, err = SaveCoverAt(cover.Path, cover.Data)
		} else {
			err = writeNewFile(cover.Path, cover.Data, 0o644)
		}
		if err != nil {
			return result, fmt.Errorf("write cover %q: %w", cover.Path, err)
		}
		result.CoverPath = cover.Path
		result.CoversSaved = 1
	}
	candidate := plan.options.Candidate
	if candidate.Source != "local-json" {
		hint := ""
		if candidate.Name != "" && candidate.Name != plan.options.DefaultAlbumName {
			hint = candidate.Name
		}
		source := candidate.Source
		if source == plan.options.DefaultSource {
			source = ""
		}
		if err := config.SaveAlbumSelection(plan.preview.Directory, source, hint); err != nil {
			return result, err
		}
	}
	err := events.emit(domain.ProgressEvent{
		Stage: domain.StageComplete, Directory: plan.preview.Directory,
		Current: len(plan.preview.Items), Total: len(plan.preview.Items),
	})
	return result, err
}

func (plan *Plan) tag(ctx context.Context, result *ExecutionResult, events EventSink) error {
	items := slices.Clone(plan.preview.Items)
	if len(items) == 0 {
		return fmt.Errorf("write plan for %q is empty", plan.preview.Directory)
	}
	for _, item := range items {
		if _, exists := plan.writers[item.Format]; !exists {
			return fmt.Errorf("%w: no tag writer registered for %s file %q", domain.ErrUnsupportedFormat, item.Format, item.SourcePath)
		}
	}
	if err := plan.prepareCovers(ctx, items, events); err != nil {
		return err
	}
	if err := events.emit(domain.ProgressEvent{
		Stage: domain.StageRename, Directory: plan.preview.Directory, Total: len(items),
	}); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := renameTwoPhase(items); err != nil {
		result.Reusable = false
		return err
	}
	result.PathsUpdated = true
	for _, item := range items {
		if normalizedPath(item.SourcePath) != normalizedPath(item.TargetPath) {
			result.Renamed++
		}
	}
	outputs := make(map[int]string)
	for _, output := range plan.preview.Outputs {
		if output.Kind == OutputLRC {
			outputs[output.ItemIndex] = output.Path
		}
	}
	written := make([]bool, len(items))
	lyrics := make([]bool, len(items))
	err := processFiles(ctx, len(items), func(index int) error {
		item := items[index]
		if err := plan.writers[item.Format].Write(ctx, item.TargetPath, item.Metadata, plan.config); err != nil {
			return fmt.Errorf("write metadata to %q: %w", item.TargetPath, err)
		}
		written[index] = true
		if path, exists := outputs[index]; exists {
			if err := os.WriteFile(path, []byte(item.Metadata.Lyric), 0o644); err != nil {
				return fmt.Errorf("write LRC %q: %w", path, err)
			}
			lyrics[index] = true
		}
		return nil
	}, func(index, completed int) error {
		return events.emit(domain.ProgressEvent{
			Stage: domain.StageWrite, Directory: plan.preview.Directory, Path: items[index].TargetPath,
			Current: completed, Total: len(items),
		})
	})
	for index := range items {
		if written[index] {
			result.Written++
		}
		if lyrics[index] {
			result.LRCFiles++
		}
	}
	return err
}

func (plan *Plan) prepareCovers(ctx context.Context, items []domain.PlanItem, events EventSink) error {
	if plan.config.CoverCompressSize <= 0 {
		return nil
	}
	threshold := int64(plan.config.CoverCompressSize * 1024 * 1024)
	for index := range items {
		item := &items[index]
		if int64(len(item.Metadata.CoverImage)) <= threshold {
			continue
		}
		if plan.coverProcessor == nil {
			return fmt.Errorf("cover exceeds compression threshold but image codec is unavailable")
		}
		if err := events.emit(domain.ProgressEvent{
			Stage: domain.StageCompress, Directory: plan.preview.Directory, Path: item.SourcePath,
		}); err != nil {
			return err
		}
		cover, err := plan.coverProcessor.Compress(ctx, item.Metadata.CoverImage, domain.CoverOptions{
			MaxDimension: plan.config.CoverCompressResolution,
		})
		if err != nil {
			return fmt.Errorf("compress cover for %q: %w", item.SourcePath, err)
		}
		item.Metadata.CoverImage = cover
	}
	return ctx.Err()
}

func (events EventSink) emit(event domain.ProgressEvent) error {
	if events != nil {
		if err := events(event); err != nil {
			return fmt.Errorf("emit %s progress: %w", event.Stage, err)
		}
	}
	return nil
}
