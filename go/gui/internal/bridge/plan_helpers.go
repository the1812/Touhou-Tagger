package bridge

import (
	"fmt"
	"path/filepath"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func inspectPlanOutputs(conflicts []coreapp.PlanOutputConflict) []StateIssue {
	issues := make([]StateIssue, 0)
	for _, conflict := range conflicts {
		switch conflict.Kind {
		case coreapp.OutputConflictDuplicate:
			message := fmt.Sprintf(
				"曲目 %d 与曲目 %d 都会写入文件 %q。",
				conflict.Other.ItemIndex+1,
				conflict.Output.ItemIndex+1,
				filepath.Base(conflict.Output.Path),
			)
			issues = append(
				issues,
				outputStateIssue(conflict.Output, "output-target-conflict", message),
				outputStateIssue(conflict.Other, "output-target-conflict", message),
			)
		case coreapp.OutputConflictExists:
			issues = append(issues, outputStateIssue(
				conflict.Output,
				conflict.Output.Kind+"-target-exists",
				fmt.Sprintf(
					"%s文件 %q 已存在，请移走后重新扫描目录。",
					outputLabel(conflict.Output.Kind),
					filepath.Base(conflict.Output.Path),
				),
			))
		case coreapp.OutputConflictInspect:
			issues = append(issues, outputStateIssue(
				conflict.Output,
				"output-target-inspection",
				fmt.Sprintf(
					"无法检查目标文件 %q：%v",
					filepath.Base(conflict.Output.Path),
					conflict.Err,
				),
			))
		}
	}
	return issues
}

func outputStateIssue(output coreapp.PlanOutput, code, message string) StateIssue {
	if output.ItemIndex >= 0 {
		return itemError(code, message, trackID(output.ItemIndex))
	}
	return errorIssue(code, message)
}

func outputLabel(kind string) string {
	if kind == coreapp.OutputCover {
		return "封面"
	}
	return "歌词"
}

func cloneMetadata(metadata []domain.Metadata) []domain.Metadata {
	result := make([]domain.Metadata, len(metadata))
	for index, item := range metadata {
		result[index] = item.Clone()
	}
	return result
}
