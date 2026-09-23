package application

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type stagedRename struct {
	item      domain.TagPlanItem
	temporary string
	state     ownedFileState
	completed bool
}

type ownedFileState struct {
	info             os.FileInfo
	size             int64
	modifiedUnixNano int64
}

type moveFile func(string, string) error

func captureOwnedFile(path string) (ownedFileState, error) {
	info, err := fileIdentity(path)
	if err != nil {
		return ownedFileState{}, err
	}
	return ownedFileState{
		info:             info,
		size:             info.Size(),
		modifiedUnixNano: info.ModTime().UnixNano(),
	}, nil
}

func matchesOwnedFile(expected ownedFileState, path string) (bool, error) {
	actual, err := fileIdentity(path)
	if err != nil {
		return false, err
	}
	return os.SameFile(expected.info, actual) &&
		expected.size == actual.Size() &&
		expected.modifiedUnixNano == actual.ModTime().UnixNano(), nil
}

func fileIdentity(path string) (_ os.FileInfo, resultErr error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, file.Close())
	}()
	return file.Stat()
}

func renameTwoPhase(items []domain.TagPlanItem) error {
	return renameTwoPhaseWith(items, renameNoReplace)
}

func renameTwoPhaseWith(items []domain.TagPlanItem, move moveFile) error {
	staged := make([]stagedRename, 0, len(items))
	for _, item := range items {
		if normalizedPath(item.SourcePath) == normalizedPath(item.TargetPath) {
			continue
		}
		state, err := captureOwnedFile(item.SourcePath)
		if err != nil {
			return errors.Join(
				fmt.Errorf("inspect source before rename %q: %w", item.SourcePath, err),
				rollbackStagedRenames(staged, move),
			)
		}
		temporary, err := reserveTemporaryPath(item.SourcePath, ".thtag-rename-*")
		if err != nil {
			return errors.Join(err, rollbackStagedRenames(staged, move))
		}
		if err := move(item.SourcePath, temporary); err != nil {
			return errors.Join(
				fmt.Errorf("stage rename %q: %w", item.SourcePath, err),
				rollbackStagedRenames(staged, move),
			)
		}
		staged = append(staged, stagedRename{item: item, temporary: temporary, state: state})
	}
	for index := range staged {
		if err := move(staged[index].temporary, staged[index].item.TargetPath); err != nil {
			return errors.Join(
				fmt.Errorf("rename %q to %q: %w", staged[index].item.SourcePath, staged[index].item.TargetPath, err),
				rollbackStagedRenames(staged, move),
			)
		}
		staged[index].completed = true
	}
	return nil
}

func rollbackStagedRenames(staged []stagedRename, move moveFile) error {
	var result error
	for index := len(staged) - 1; index >= 0; index-- {
		item := &staged[index]
		if !item.completed {
			continue
		}
		if err := move(item.item.TargetPath, item.temporary); err != nil {
			result = errors.Join(result, fmt.Errorf(
				"restage completed rename %q as %q: %w",
				item.item.TargetPath, item.temporary, err,
			))
			continue
		}
		item.completed = false
	}
	for index := len(staged) - 1; index >= 0; index-- {
		item := staged[index]
		from := item.temporary
		if item.completed {
			from = item.item.TargetPath
		}
		matches, err := matchesOwnedFile(item.state, from)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			result = errors.Join(result, fmt.Errorf("inspect staged rename %q: %w", from, err))
			continue
		}
		if !matches {
			result = errors.Join(result, fmt.Errorf(
				"staged file for %q changed and was retained at %q",
				item.item.SourcePath,
				from,
			))
			continue
		}
		if err := move(from, item.item.SourcePath); err != nil {
			result = errors.Join(result, fmt.Errorf(
				"restore %q to %q without replacing the current file: %w; staged file retained at %q",
				from,
				item.item.SourcePath,
				err,
				from,
			))
		}
	}
	return result
}

func reserveTemporaryPath(sourcePath, pattern string) (string, error) {
	file, err := os.CreateTemp(filepath.Dir(sourcePath), pattern)
	if err != nil {
		return "", fmt.Errorf("reserve temporary path beside %q: %w", sourcePath, err)
	}
	path := file.Name()
	closeErr := file.Close()
	removeErr := os.Remove(path)
	if closeErr != nil || removeErr != nil {
		return "", fmt.Errorf("reserve temporary path beside %q: %w", sourcePath, errors.Join(closeErr, removeErr))
	}
	return path, nil
}

func writeNewFile(path string, data []byte, mode os.FileMode) (resultErr error) {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if err != nil {
		return err
	}
	closed := false
	completed := false
	defer func() {
		if !completed {
			if !closed {
				resultErr = errors.Join(resultErr, file.Close())
			}
			resultErr = errors.Join(resultErr, removeFile(path))
		}
	}()
	_, writeErr := file.Write(data)
	syncErr := file.Sync()
	closeErr := file.Close()
	closed = true
	if err := errors.Join(writeErr, syncErr, closeErr); err != nil {
		return err
	}
	completed = true
	return nil
}

func removeFile(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove %q: %w", path, err)
	}
	return nil
}
