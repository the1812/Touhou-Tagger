package filesystem

import (
	"errors"
	"os"
	"path/filepath"
)

func WriteFileAtomic(path string, data []byte, mode os.FileMode) (resultErr error) {
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
			resultErr = errors.Join(resultErr, os.Remove(temporaryPath))
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
