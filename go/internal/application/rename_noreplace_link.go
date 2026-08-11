//go:build !windows

package application

import (
	"fmt"
	"os"
)

func linkNoReplace(oldPath, newPath string) error {
	if err := os.Link(oldPath, newPath); err != nil {
		return err
	}
	if err := os.Remove(oldPath); err != nil {
		return fmt.Errorf(
			"remove %q after linking it to %q: %w; both paths were retained",
			oldPath,
			newPath,
			err,
		)
	}
	return nil
}
