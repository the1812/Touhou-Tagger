//go:build !windows && !linux

package application

func renameNoReplace(oldPath, newPath string) error {
	return linkNoReplace(oldPath, newPath)
}
