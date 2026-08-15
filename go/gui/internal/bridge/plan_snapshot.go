package bridge

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func canCommit(session *planSession) bool {
	if len(session.plan.Items) == 0 || session.committing {
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

func snapshotPlanInputs(scan domain.AlbumScan) (planSnapshot, error) {
	audioFiles := make([]fileSnapshot, len(scan.AudioFiles))
	for index, audio := range scan.AudioFiles {
		snapshot, err := snapshotPath(audio.Path, false)
		if err != nil {
			return planSnapshot{}, fmt.Errorf("检查音频文件 %q: %w", audio.Path, err)
		}
		if !snapshot.Exists {
			return planSnapshot{}, fmt.Errorf("音频文件 %q 已不存在", audio.Path)
		}
		audioFiles[index] = snapshot
	}
	localCover, err := snapshotPath(scan.CoverPath, true)
	if err != nil {
		return planSnapshot{}, fmt.Errorf("检查本地封面 %q: %w", scan.CoverPath, err)
	}
	metadata, err := snapshotPath(scan.MetadataPath, true)
	if err != nil {
		return planSnapshot{}, fmt.Errorf("检查本地元数据 %q: %w", scan.MetadataPath, err)
	}
	albumConfig, err := snapshotPath(filepath.Join(scan.Directory, "thtag.json"), true)
	if err != nil {
		return planSnapshot{}, fmt.Errorf("检查专辑配置: %w", err)
	}
	return planSnapshot{
		AudioFiles:  audioFiles,
		LocalCover:  localCover,
		Metadata:    metadata,
		AlbumConfig: albumConfig,
	}, nil
}

func snapshotPlanOutputs(
	plan domain.TagPlan,
	configValue domain.MetadataConfig,
	directory string,
	cover []byte,
	saveCover bool,
	existingCoverPath string,
) ([]outputSnapshot, []StateIssue) {
	outputs, err := plannedOutputs(
		plan,
		configValue,
		directory,
		cover,
		saveCover,
		existingCoverPath,
	)
	if err != nil {
		return nil, []StateIssue{errorIssue(
			"cover-target-invalid",
			fmt.Sprintf("无法确定封面保存位置：%v", err),
		)}
	}
	issues := make([]StateIssue, 0)
	for _, conflict := range coreapp.InspectPlanOutputs(outputs) {
		if conflict.Kind != coreapp.OutputConflictDuplicate {
			continue
		}
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
	}
	snapshots := make([]outputSnapshot, 0, len(outputs))
	for _, output := range outputs {
		snapshot, snapshotErr := snapshotPath(output.Path, true)
		if snapshotErr != nil {
			issues = append(issues, outputStateIssue(
				output,
				"output-target-inspection",
				fmt.Sprintf("无法检查目标文件 %q：%v", filepath.Base(output.Path), snapshotErr),
			))
		} else if snapshot.Exists && !isCoverOverwrite(output, existingCoverPath) {
			issues = append(issues, outputStateIssue(
				output,
				output.Kind+"-target-exists",
				fmt.Sprintf(
					"%s目标文件 %q 已存在；请移走后重新准备写入内容，避免覆盖。",
					outputLabel(output.Kind),
					filepath.Base(output.Path),
				),
			))
		}
		snapshots = append(snapshots, outputSnapshot{
			Kind:   output.Kind,
			ItemID: outputItemID(output),
			File:   snapshot,
		})
	}
	return snapshots, issues
}

func plannedOutputs(
	plan domain.TagPlan,
	configValue domain.MetadataConfig,
	directory string,
	cover []byte,
	saveCover bool,
	existingCoverPath string,
) ([]coreapp.PlanOutput, error) {
	outputs := coreapp.TagPlanOutputs(plan, configValue)
	if !saveCover {
		return outputs, nil
	}
	path := existingCoverPath
	if path == "" {
		var err error
		path, err = coreapp.CoverPath(directory, cover)
		if err != nil {
			return nil, err
		}
	}
	return append(outputs, coreapp.PlanOutput{
		Kind:      coreapp.OutputCover,
		Path:      path,
		ItemIndex: -1,
	}), nil
}

func validatePlanInputs(scan domain.AlbumScan, expected planSnapshot) error {
	if len(scan.AudioFiles) != len(expected.AudioFiles) {
		return fmt.Errorf("目录中的音频文件数量已变化，请重新扫描")
	}
	for index, audio := range scan.AudioFiles {
		snapshot := expected.AudioFiles[index]
		if !equalPath(audio.Path, snapshot.Path) {
			return fmt.Errorf("目录中的音频文件顺序或名称已变化，请重新扫描")
		}
		changed, err := snapshotChanged(snapshot)
		if err != nil {
			return fmt.Errorf("重新检查音频文件 %q: %w", audio.Path, err)
		}
		if changed {
			return fmt.Errorf("音频文件 %q 在准备写入后发生了变化，请重新扫描", filepath.Base(audio.Path))
		}
	}
	if err := validateSelectedInput("本地封面", scan.CoverPath, expected.LocalCover); err != nil {
		return err
	}
	if err := validateSelectedInput("本地元数据", scan.MetadataPath, expected.Metadata); err != nil {
		return err
	}
	changed, err := snapshotChanged(expected.AlbumConfig)
	if err != nil {
		return fmt.Errorf("重新检查专辑配置 thtag.json: %w", err)
	}
	if changed {
		return fmt.Errorf("专辑配置 thtag.json 在准备写入后出现、移除或发生变化，请重新准备写入内容")
	}
	return nil
}

func validatePlanOutputs(
	plan domain.TagPlan,
	configValue domain.MetadataConfig,
	directory string,
	cover []byte,
	saveCover bool,
	existingCoverPath string,
	expected []outputSnapshot,
) error {
	outputs, err := plannedOutputs(
		plan,
		configValue,
		directory,
		cover,
		saveCover,
		existingCoverPath,
	)
	if err != nil {
		return fmt.Errorf("重新确定附加文件目标: %w", err)
	}
	if len(outputs) != len(expected) {
		return fmt.Errorf("写入内容的附加文件目标已变化，请重新准备")
	}
	for index, output := range outputs {
		snapshot := expected[index]
		if output.Kind != snapshot.Kind ||
			outputItemID(output) != snapshot.ItemID ||
			!equalPath(output.Path, snapshot.File.Path) {
			return fmt.Errorf("写入内容的附加文件目标已变化，请重新准备")
		}
		if snapshot.File.Exists && !isCoverOverwrite(output, existingCoverPath) {
			return fmt.Errorf(
				"%s目标文件 %q 在准备写入时已存在，请移走后重新准备写入内容",
				outputLabel(output.Kind),
				filepath.Base(output.Path),
			)
		}
		changed, snapshotErr := snapshotChanged(snapshot.File)
		if snapshotErr != nil {
			return fmt.Errorf("重新检查附加文件目标 %q: %w", output.Path, snapshotErr)
		}
		if changed {
			return fmt.Errorf(
				"%s目标文件 %q 在准备写入后出现或发生变化，请重新准备写入内容",
				outputLabel(output.Kind),
				filepath.Base(output.Path),
			)
		}
	}
	for _, conflict := range coreapp.InspectPlanOutputs(outputs) {
		if conflict.Kind == coreapp.OutputConflictExists &&
			isCoverOverwrite(conflict.Output, existingCoverPath) {
			continue
		}
		return fmt.Errorf(
			"%s目标文件 %q 发生冲突，请重新准备写入内容",
			outputLabel(conflict.Output.Kind),
			filepath.Base(conflict.Output.Path),
		)
	}
	return nil
}

func isCoverOverwrite(output coreapp.PlanOutput, existingCoverPath string) bool {
	return output.Kind == coreapp.OutputCover &&
		existingCoverPath != "" &&
		equalPath(output.Path, existingCoverPath)
}

func snapshotPath(path string, digest bool) (fileSnapshot, error) {
	snapshot := fileSnapshot{Path: path, HasDigest: digest}
	if path == "" {
		return snapshot, nil
	}
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return snapshot, nil
	}
	if err != nil {
		return fileSnapshot{}, err
	}
	snapshot.Exists = true
	snapshot.Size = info.Size()
	snapshot.ModifiedUnixNano = info.ModTime().UnixNano()
	if digest && info.Mode().IsRegular() {
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return fileSnapshot{}, readErr
		}
		current, statErr := os.Stat(path)
		if statErr != nil {
			return fileSnapshot{}, statErr
		}
		if current.Size() != snapshot.Size ||
			current.ModTime().UnixNano() != snapshot.ModifiedUnixNano {
			return fileSnapshot{}, fmt.Errorf("检查文件时文件发生了变化")
		}
		snapshot.Digest = sha256.Sum256(data)
	}
	return snapshot, nil
}

func snapshotChanged(expected fileSnapshot) (bool, error) {
	actual, err := snapshotPath(expected.Path, expected.HasDigest)
	if err != nil {
		return false, err
	}
	if actual.Exists != expected.Exists {
		return true, nil
	}
	if !actual.Exists {
		return false, nil
	}
	if actual.Size != expected.Size ||
		actual.ModifiedUnixNano != expected.ModifiedUnixNano {
		return true, nil
	}
	return expected.HasDigest && actual.Digest != expected.Digest, nil
}

func validateSelectedInput(label, currentPath string, expected fileSnapshot) error {
	if expected.Path == "" && currentPath == "" {
		return nil
	}
	if expected.Path == "" ||
		currentPath == "" ||
		!equalPath(currentPath, expected.Path) {
		return fmt.Errorf("%s在准备写入后出现、移除或更换，请重新准备写入内容", label)
	}
	changed, err := snapshotChanged(expected)
	if err != nil {
		return fmt.Errorf("重新检查%s %q: %w", label, expected.Path, err)
	}
	if changed {
		return fmt.Errorf("%s %q 在准备写入后发生变化，请重新准备写入内容", label, filepath.Base(expected.Path))
	}
	return nil
}

func clonePlanSnapshot(snapshot planSnapshot) planSnapshot {
	snapshot.AudioFiles = slices.Clone(snapshot.AudioFiles)
	snapshot.Outputs = slices.Clone(snapshot.Outputs)
	return snapshot
}

func outputStateIssue(output coreapp.PlanOutput, code, message string) StateIssue {
	if output.ItemIndex >= 0 {
		return itemError(code, message, trackID(output.ItemIndex))
	}
	return errorIssue(code, message)
}

func outputItemID(output coreapp.PlanOutput) string {
	if output.ItemIndex < 0 {
		return ""
	}
	return trackID(output.ItemIndex)
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
		result[index] = item
		result[index].AlbumArtists = append([]string(nil), item.AlbumArtists...)
		result[index].Genres = append([]string(nil), item.Genres...)
		result[index].CoverImage = item.CoverImage
		result[index].Artists = append([]string(nil), item.Artists...)
		result[index].Composers = append([]string(nil), item.Composers...)
		result[index].Lyricists = append([]string(nil), item.Lyricists...)
		if item.ExtraData != nil {
			result[index].ExtraData = make(map[string]any, len(item.ExtraData))
			for key, value := range item.ExtraData {
				result[index].ExtraData[key] = value
			}
		}
	}
	return result
}
