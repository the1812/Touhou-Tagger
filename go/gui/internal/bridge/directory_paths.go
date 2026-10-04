package bridge

import (
	"path/filepath"
	"runtime"
	"strings"
)

func directoryKey(directory string) string {
	path := filepath.Clean(directory)
	if runtime.GOOS == "windows" {
		return strings.ToLower(path)
	}
	return path
}

func sameDirectory(left, right string) bool {
	return directoryKey(left) == directoryKey(right)
}

func nestedDirectory(parent, child string) bool {
	separator := string(filepath.Separator)
	return strings.HasPrefix(directoryKey(child), strings.TrimRight(directoryKey(parent), separator)+separator)
}
