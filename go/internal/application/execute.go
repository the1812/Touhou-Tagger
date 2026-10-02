package application

import (
	"context"
	"fmt"
	"os"

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

func (plan *Plan) Execute(ctx context.Context) (ExecutionResult, error) {
	result := ExecutionResult{Reusable: true}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if err := plan.checkFiles(); err != nil {
		result.Reusable = false
		return result, err
	}
	if err := validatePlanOutputs(plan.preview.Outputs); err != nil {
		return result, err
	}
	if err := plan.tag(ctx, &result); err != nil {
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
	err := plan.emit(domain.ProgressEvent{
		Stage: domain.StageComplete, Directory: plan.preview.Directory,
		Current: len(plan.preview.Items), Total: len(plan.preview.Items),
	})
	return result, err
}

func (plan *Plan) tag(ctx context.Context, result *ExecutionResult) error {
	items := plan.preview.Items
	if len(items) == 0 {
		return fmt.Errorf("write plan for %q is empty", plan.preview.Directory)
	}
	for _, item := range items {
		if _, exists := plan.writers[item.Format]; !exists {
			return fmt.Errorf("%w: no tag writer registered for %s file %q", domain.ErrUnsupportedFormat, item.Format, item.SourcePath)
		}
	}
	if err := plan.emit(domain.ProgressEvent{
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
		return plan.emit(domain.ProgressEvent{
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
