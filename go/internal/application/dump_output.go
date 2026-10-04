package application

import (
	"context"
	"errors"
	"fmt"
	"os"
)

func writeDumpFile(ctx context.Context, path string, data []byte, expected ownedFileState) (resultErr error) {
	temporary, err := reserveTemporaryPath(path, ".thtag-dump-*")
	if err != nil {
		return err
	}
	defer func() { resultErr = errors.Join(resultErr, removeFile(temporary)) }()
	if err := writeNewFile(temporary, data, 0o644); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if expected.info == nil {
		return renameNoReplace(temporary, path)
	}
	matches, err := matchesOwnedFile(expected, path)
	if err != nil {
		return err
	}
	if !matches {
		return fmt.Errorf("dump output changed before replacement: %q", path)
	}
	return os.Rename(temporary, path)
}
