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
	source   string
	backup   string
	original ownedFileState
	written  ownedFileState
}

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

type sourceSnapshot struct {
	path  string
	state ownedFileState
}

type moveFile func(string, string) error

func snapshotSources(items []domain.TagPlanItem) ([]sourceSnapshot, error) {
	snapshots := make([]sourceSnapshot, len(items))
	for index, item := range items {
		state, err := captureOwnedFile(item.SourcePath)
		if err != nil {
			return nil, fmt.Errorf("snapshot source file %q: %w", item.SourcePath, err)
		}
		snapshots[index] = sourceSnapshot{
			path:  item.SourcePath,
			state: state,
		}
	}
	return snapshots, nil
}

func validateSourceSnapshots(snapshots []sourceSnapshot) error {
	for _, snapshot := range snapshots {
		matches, err := matchesOwnedFile(snapshot.state, snapshot.path)
		if err != nil {
			return fmt.Errorf("revalidate source file %q: %w", snapshot.path, err)
		}
		if !matches {
			return fmt.Errorf("source file %q changed while preparing the tag plan", snapshot.path)
		}
	}
	return nil
}

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

func replaceOriginals(prepared []preparedWrite, sources []sourceSnapshot) error {
	return replaceOriginalsWith(prepared, sources, renameNoReplace)
}

func replaceOriginalsWith(
	prepared []preparedWrite,
	sources []sourceSnapshot,
	move moveFile,
) error {
	if len(prepared) != len(sources) {
		return fmt.Errorf(
			"replace original source snapshot count mismatch: prepared %d, snapshots %d",
			len(prepared),
			len(sources),
		)
	}
	replacements := make([]replacement, 0, len(prepared))
	for index, item := range prepared {
		source := sources[index]
		if normalizedPath(source.path) != normalizedPath(item.item.SourcePath) {
			return errors.Join(
				fmt.Errorf(
					"replace original source mismatch: prepared %q, snapshot %q",
					item.item.SourcePath,
					source.path,
				),
				rollbackReplacementsWith(replacements, move),
			)
		}
		written, err := captureOwnedFile(item.temporary)
		if err != nil {
			return errors.Join(
				fmt.Errorf("inspect prepared file %q: %w", item.temporary, err),
				rollbackReplacementsWith(replacements, move),
			)
		}
		backup, err := reserveTemporaryPath(item.item.SourcePath, ".thtag-backup-*")
		if err != nil {
			return errors.Join(err, rollbackReplacementsWith(replacements, move))
		}
		if err := move(item.item.SourcePath, backup); err != nil {
			return errors.Join(
				fmt.Errorf("stage original file %q: %w", item.item.SourcePath, err),
				rollbackReplacementsWith(replacements, move),
			)
		}
		matches, matchErr := matchesOwnedFile(source.state, backup)
		if matchErr != nil || !matches {
			verifyErr := matchErr
			if verifyErr == nil {
				verifyErr = fmt.Errorf("source identity, size, or modification time changed")
			}
			restoreErr := move(backup, item.item.SourcePath)
			if restoreErr != nil {
				restoreErr = fmt.Errorf(
					"restore changed source %q without replacing the current file: %w; changed source retained at backup %q",
					item.item.SourcePath,
					restoreErr,
					backup,
				)
			}
			return errors.Join(
				fmt.Errorf(
					"source file %q changed before replacement: %w",
					item.item.SourcePath,
					verifyErr,
				),
				restoreErr,
				rollbackReplacementsWith(replacements, move),
			)
		}
		if err := move(item.temporary, item.item.SourcePath); err != nil {
			replaceErr := fmt.Errorf("replace original file %q: %w", item.item.SourcePath, err)
			restoreErr := move(backup, item.item.SourcePath)
			if restoreErr != nil {
				restoreErr = fmt.Errorf(
					"restore original file %q without replacing the current file: %w; original retained at backup %q",
					item.item.SourcePath,
					restoreErr,
					backup,
				)
			}
			return errors.Join(
				replaceErr,
				restoreErr,
				rollbackReplacementsWith(replacements, move),
			)
		}
		replacements = append(replacements, replacement{
			source:   item.item.SourcePath,
			backup:   backup,
			original: source.state,
			written:  written,
		})
	}
	var cleanupErr error
	for _, item := range replacements {
		matches, err := matchesOwnedFile(item.original, item.backup)
		if err != nil {
			cleanupErr = errors.Join(
				cleanupErr,
				fmt.Errorf("inspect backup %q before cleanup: %w", item.backup, err),
			)
			continue
		}
		if !matches {
			cleanupErr = errors.Join(
				cleanupErr,
				fmt.Errorf("backup %q changed before cleanup and was retained", item.backup),
			)
			continue
		}
		if err := os.Remove(item.backup); err != nil && !os.IsNotExist(err) {
			cleanupErr = errors.Join(cleanupErr, fmt.Errorf("remove backup %q: %w", item.backup, err))
		}
	}
	return cleanupErr
}

func rollbackReplacementsWith(replacements []replacement, move moveFile) error {
	var result error
	for index := len(replacements) - 1; index >= 0; index-- {
		item := replacements[index]
		retained, err := reserveTemporaryPath(item.source, ".thtag-rollback-*")
		if err != nil {
			result = errors.Join(result, fmt.Errorf(
				"reserve rollback path for %q: %w; original retained at backup %q",
				item.source,
				err,
				item.backup,
			))
			continue
		}
		if err := move(item.source, retained); err != nil {
			result = errors.Join(result, fmt.Errorf(
				"stage current file %q for rollback: %w; original retained at backup %q",
				item.source,
				err,
				item.backup,
			))
			continue
		}
		if err := move(item.backup, item.source); err != nil {
			result = errors.Join(result, fmt.Errorf(
				"restore original file %q from backup %q without replacing the current file: %w; current file retained at %q",
				item.source,
				item.backup,
				err,
				retained,
			))
			continue
		}
		matches, err := matchesOwnedFile(item.written, retained)
		if err != nil {
			result = errors.Join(result, fmt.Errorf(
				"inspect rolled-back file %q: %w",
				retained,
				err,
			))
			continue
		}
		if !matches {
			result = errors.Join(result, fmt.Errorf(
				"file at %q changed during rollback and was retained at %q",
				item.source,
				retained,
			))
			continue
		}
		if err := os.Remove(retained); err != nil && !os.IsNotExist(err) {
			result = errors.Join(result, fmt.Errorf(
				"remove rolled-back prepared file %q: %w",
				retained,
				err,
			))
		}
	}
	return result
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
