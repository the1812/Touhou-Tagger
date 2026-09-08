package domain

import (
	"errors"
	"fmt"
)

var (
	ErrNoAudio           = errors.New("no supported audio files found")
	ErrSourceChanged     = errors.New("source file changed while preparing the tag plan")
	ErrUnsupportedFormat = errors.New("unsupported audio format")
)

type TrackCountMismatchError struct {
	Directory string
	Files     int
	Tracks    int
}

func (err *TrackCountMismatchError) Error() string {
	return fmt.Sprintf("track count mismatch in %q: found %d audio files but metadata contains %d tracks", err.Directory, err.Files, err.Tracks)
}

type FileConflictError struct {
	Path      string
	OtherPath string
}

func (err *FileConflictError) Error() string {
	if err.OtherPath != "" {
		return fmt.Sprintf("target filename conflict: %q and %q", err.OtherPath, err.Path)
	}
	return fmt.Sprintf("target file already exists: %q", err.Path)
}

type ParseKind int

const (
	ConfigData ParseKind = iota
	MetadataData
	RemoteResponse
)

type ParseError struct {
	Kind ParseKind
	Err  error
}

func (err *ParseError) Error() string { return err.Err.Error() }
func (err *ParseError) Unwrap() error { return err.Err }
