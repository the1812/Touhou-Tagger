package application

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type preparedWrite struct {
	item      domain.TagPlanItem
	temporary string
}

type replacement struct {
	source string
	backup string
}

type stagedRename struct {
	item      domain.TagPlanItem
	temporary string
	completed bool
}

func copyToTemporary(ctx context.Context, sourcePath, pattern string) (result string, resultErr error) {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return "", fmt.Errorf("stat source file %q: %w", sourcePath, err)
	}
	source, err := os.Open(sourcePath)
	if err != nil {
		return "", fmt.Errorf("open source file %q: %w", sourcePath, err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, source.Close())
	}()
	target, err := os.CreateTemp(filepath.Dir(sourcePath), pattern)
	if err != nil {
		return "", fmt.Errorf("create temporary file beside %q: %w", sourcePath, err)
	}
	temporaryPath := target.Name()
	defer func() {
		if closeErr := target.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, closeErr)
		}
		if resultErr != nil {
			if removeErr := os.Remove(temporaryPath); removeErr != nil && !os.IsNotExist(removeErr) {
				resultErr = errors.Join(resultErr, removeErr)
			}
		}
	}()
	if err := target.Chmod(info.Mode()); err != nil {
		return "", fmt.Errorf("set temporary file mode for %q: %w", sourcePath, err)
	}
	buffer := make([]byte, 128*1024)
	for {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		read, readErr := source.Read(buffer)
		if read > 0 {
			if _, err := target.Write(buffer[:read]); err != nil {
				return "", fmt.Errorf("copy source file %q: %w", sourcePath, err)
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return "", fmt.Errorf("read source file %q: %w", sourcePath, readErr)
		}
	}
	if err := target.Sync(); err != nil {
		return "", fmt.Errorf("flush temporary file for %q: %w", sourcePath, err)
	}
	return temporaryPath, nil
}

func cleanupPrepared(prepared []preparedWrite) error {
	var result error
	for _, item := range prepared {
		result = errors.Join(result, removeFile(item.temporary))
	}
	return result
}

func replaceOriginals(prepared []preparedWrite) error {
	replacements := make([]replacement, 0, len(prepared))
	for _, item := range prepared {
		backup, err := reserveTemporaryPath(item.item.SourcePath, ".thtag-backup-*")
		if err != nil {
			return errors.Join(err, rollbackReplacements(replacements))
		}
		if err := os.Rename(item.item.SourcePath, backup); err != nil {
			return errors.Join(
				fmt.Errorf("stage original file %q: %w", item.item.SourcePath, err),
				removeFile(backup),
				rollbackReplacements(replacements),
			)
		}
		if err := os.Rename(item.temporary, item.item.SourcePath); err != nil {
			restoreErr := os.Rename(backup, item.item.SourcePath)
			return errors.Join(fmt.Errorf("replace original file %q: %w", item.item.SourcePath, err), restoreErr, rollbackReplacements(replacements))
		}
		replacements = append(replacements, replacement{source: item.item.SourcePath, backup: backup})
	}
	var cleanupErr error
	for _, item := range replacements {
		if err := os.Remove(item.backup); err != nil && !os.IsNotExist(err) {
			cleanupErr = errors.Join(cleanupErr, fmt.Errorf("remove backup %q: %w", item.backup, err))
		}
	}
	return cleanupErr
}

func rollbackReplacements(replacements []replacement) error {
	var result error
	for index := len(replacements) - 1; index >= 0; index-- {
		item := replacements[index]
		if err := os.Remove(item.source); err != nil && !os.IsNotExist(err) {
			result = errors.Join(result, err)
		}
		if err := os.Rename(item.backup, item.source); err != nil {
			result = errors.Join(result, err)
		}
	}
	return result
}

func renameTwoPhase(items []domain.TagPlanItem) error {
	return renameTwoPhaseWith(items, os.Rename)
}

func renameTwoPhaseWith(items []domain.TagPlanItem, rename func(string, string) error) error {
	staged := make([]stagedRename, 0, len(items))
	for _, item := range items {
		if normalizedPath(item.SourcePath) == normalizedPath(item.TargetPath) {
			continue
		}
		temporary, err := reserveTemporaryPath(item.SourcePath, ".thtag-rename-*")
		if err != nil {
			return errors.Join(err, rollbackStagedRenames(staged, rename))
		}
		if err := rename(item.SourcePath, temporary); err != nil {
			return errors.Join(
				fmt.Errorf("stage rename %q: %w", item.SourcePath, err),
				removeFile(temporary),
				rollbackStagedRenames(staged, rename),
			)
		}
		staged = append(staged, stagedRename{item: item, temporary: temporary})
	}
	for index := range staged {
		if err := rename(staged[index].temporary, staged[index].item.TargetPath); err != nil {
			return errors.Join(
				fmt.Errorf("rename %q to %q: %w", staged[index].item.SourcePath, staged[index].item.TargetPath, err),
				rollbackStagedRenames(staged, rename),
			)
		}
		staged[index].completed = true
	}
	return nil
}

func rollbackStagedRenames(staged []stagedRename, rename func(string, string) error) error {
	var result error
	for index := len(staged) - 1; index >= 0; index-- {
		item := &staged[index]
		if !item.completed {
			continue
		}
		if err := rename(item.item.TargetPath, item.temporary); err != nil {
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
		if _, err := os.Stat(from); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			result = errors.Join(result, fmt.Errorf("inspect staged rename %q: %w", from, err))
			continue
		}
		if err := rename(from, item.item.SourcePath); err != nil {
			result = errors.Join(result, fmt.Errorf("restore %q to %q: %w", from, item.item.SourcePath, err))
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

func atomicWrite(path string, data []byte, mode os.FileMode) (resultErr error) {
	temporary, err := os.CreateTemp(filepath.Dir(path), ".thtag-output-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	closed := false
	defer func() {
		if !closed {
			resultErr = errors.Join(resultErr, temporary.Close())
		}
		if resultErr != nil {
			resultErr = errors.Join(resultErr, removeFile(temporaryPath))
		}
	}()
	if err := temporary.Chmod(mode); err != nil {
		return err
	}
	_, writeErr := temporary.Write(data)
	syncErr := temporary.Sync()
	closeErr := temporary.Close()
	closed = true
	if err := errors.Join(writeErr, syncErr, closeErr); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return err
	}
	return nil
}

func removeFile(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove %q: %w", path, err)
	}
	return nil
}
