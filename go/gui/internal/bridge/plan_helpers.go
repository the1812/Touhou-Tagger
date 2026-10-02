package bridge

import (
	"fmt"
	"path/filepath"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func canCommit(session *planSession) bool {
	if session.plan == nil || session.committing {
		return false
	}
	for _, issue := range session.issues {
		if issue.Severity == "error" {
			return false
		}
	}
	return true
}

func applyAlbumPatch(metadata []domain.Metadata, patch AlbumMetadataPatch) {
	for index := range metadata {
		item := &metadata[index]
		if patch.Title != nil {
			item.Album = *patch.Title
		}
		if patch.AlbumOrder != nil {
			item.AlbumOrder = *patch.AlbumOrder
		}
		if patch.Artists != nil {
			item.AlbumArtists = append([]string(nil), (*patch.Artists)...)
		}
		if patch.Year != nil {
			item.Year = *patch.Year
		}
		if patch.Genres != nil {
			item.Genres = append([]string(nil), (*patch.Genres)...)
		}
	}
}

func applyTrackPatch(metadata *domain.Metadata, patch TrackMetadataPatch) {
	if patch.DiscNumber != nil {
		metadata.DiscNumber = *patch.DiscNumber
	}
	if patch.TrackNumber != nil {
		metadata.TrackNumber = *patch.TrackNumber
	}
	if patch.Title != nil {
		metadata.Title = *patch.Title
	}
	if patch.Artists != nil {
		metadata.Artists = append([]string(nil), (*patch.Artists)...)
	}
	if patch.Comments != nil {
		metadata.Comments = *patch.Comments
	}
}

func inspectPlanOutputs(conflicts []coreapp.PlanOutputConflict) []StateIssue {
	issues := make([]StateIssue, 0)
	for _, conflict := range conflicts {
		switch conflict.Kind {
		case coreapp.OutputConflictDuplicate:
			message := fmt.Sprintf(
				"附加文件目标冲突：曲目 %d 与曲目 %d 都会写入 %q。",
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
					"%s目标文件 %q 已存在；请移走后重新准备写入内容，避免覆盖。",
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

func (session *planSession) coverOutput() (*coreapp.CoverOutput, error) {
	if !session.saveCover || len(session.cover) == 0 {
		return nil, nil
	}
	path := session.scan.CoverPath
	if path == "" {
		var err error
		path, err = coreapp.CoverPath(session.scan.Directory, session.cover)
		if err != nil {
			return nil, err
		}
	}
	return &coreapp.CoverOutput{Path: path, Data: session.cover, Replace: session.scan.CoverPath != ""}, nil
}
