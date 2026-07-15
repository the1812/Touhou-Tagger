package testutil

import (
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func FixtureFS(t testing.TB) fs.FS {
	t.Helper()
	return os.DirFS(fixtureRoot(t))
}

func FixturePath(t testing.TB, paths ...string) string {
	t.Helper()
	return filepath.Join(append([]string{fixtureRoot(t)}, paths...)...)
}

func ReadFixture(t testing.TB, paths ...string) []byte {
	t.Helper()
	data, err := os.ReadFile(FixturePath(t, paths...))
	if err != nil {
		t.Fatalf("read fixture %v: %v", paths, err)
	}
	return data
}

func fixtureRoot(t testing.TB) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve fixture helper source path")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "fixtures"))
}
