package application

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

const (
	OutputLRC   = "lrc"
	OutputCover = "cover"
)

const (
	OutputConflictExists    = "exists"
	OutputConflictDuplicate = "duplicate"
	OutputConflictInspect   = "inspect"
)

type PlanOutput struct {
	Kind      string
	Path      string
	ItemIndex int
}

type PlanOutputConflict struct {
	Kind   string
	Output PlanOutput
	Other  PlanOutput
	Err    error
}

type PlanOutputConflictError struct {
	Err error
}

func (err *PlanOutputConflictError) Error() string {
	return err.Err.Error()
}

func (err *PlanOutputConflictError) Unwrap() error {
	return err.Err
}

func PlanOutputsChanged(err error) bool {
	var conflict *PlanOutputConflictError
	return errors.As(err, &conflict)
}

func TagPlanOutputs(plan domain.TagPlan, config domain.MetadataConfig) []PlanOutput {
	if !config.LyricEnabled || config.Lyric == nil || config.Lyric.Output != domain.LyricLRC {
		return nil
	}
	outputs := make([]PlanOutput, 0, len(plan.Items))
	for index, item := range plan.Items {
		if item.Metadata.Lyric == "" {
			continue
		}
		outputs = append(outputs, PlanOutput{
			Kind:      OutputLRC,
			Path:      LRCPath(item.TargetPath),
			ItemIndex: index,
		})
	}
	return outputs
}

func InspectPlanOutputs(outputs []PlanOutput) []PlanOutputConflict {
	conflicts := make([]PlanOutputConflict, 0)
	seen := make(map[string]PlanOutput, len(outputs))
	for _, output := range outputs {
		key := pathKey(output.Path)
		if other, exists := seen[key]; exists {
			conflicts = append(conflicts, PlanOutputConflict{
				Kind:   OutputConflictDuplicate,
				Output: output,
				Other:  other,
			})
		} else {
			seen[key] = output
		}
		if _, err := os.Stat(output.Path); err == nil {
			conflicts = append(conflicts, PlanOutputConflict{
				Kind:   OutputConflictExists,
				Output: output,
			})
		} else if !os.IsNotExist(err) {
			conflicts = append(conflicts, PlanOutputConflict{
				Kind:   OutputConflictInspect,
				Output: output,
				Err:    err,
			})
		}
	}
	return conflicts
}

func ValidateTagPlanOutputs(plan domain.TagPlan, config domain.MetadataConfig) error {
	conflicts := InspectPlanOutputs(TagPlanOutputs(plan, config))
	if len(conflicts) == 0 {
		return nil
	}
	conflict := conflicts[0]
	switch conflict.Kind {
	case OutputConflictExists:
		return &PlanOutputConflictError{Err: fmt.Errorf(
			"output file already exists: %q",
			conflict.Output.Path,
		)}
	case OutputConflictDuplicate:
		return &PlanOutputConflictError{Err: fmt.Errorf(
			"output file conflict: tracks %d and %d both target %q",
			conflict.Other.ItemIndex+1,
			conflict.Output.ItemIndex+1,
			conflict.Output.Path,
		)}
	default:
		return &PlanOutputConflictError{Err: fmt.Errorf(
			"inspect output file %q: %w",
			conflict.Output.Path,
			conflict.Err,
		)}
	}
}

func LRCPath(audioPath string) string {
	return strings.TrimSuffix(audioPath, filepath.Ext(audioPath)) + ".lrc"
}
