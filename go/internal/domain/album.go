package domain

import "time"

type AudioFormat string

const (
	FormatMP3  AudioFormat = "mp3"
	FormatFLAC AudioFormat = "flac"
)

type AudioFile struct {
	Path   string
	Format AudioFormat
}

type AlbumScan struct {
	Directory    string
	AudioFiles   []AudioFile
	CoverPath    string
	MetadataPath string
}

type PlanItem struct {
	SourcePath string
	TargetPath string
	Format     AudioFormat
	Metadata   Metadata
}

type BatchScanEntry struct {
	Directory    string
	Name         string
	AudioCount   int
	PreflightErr error
	Ignored      bool
}

type BatchResult struct {
	Entry    BatchScanEntry
	Duration time.Duration
	Err      error
}

type EventStage string

const (
	StageScan     EventStage = "scan"
	StageSearch   EventStage = "search"
	StageFetch    EventStage = "fetch"
	StagePlan     EventStage = "plan"
	StageWrite    EventStage = "write"
	StageRename   EventStage = "rename"
	StageComplete EventStage = "complete"
)

type ProgressEvent struct {
	Stage     EventStage
	Directory string
	Path      string
	Current   int
	Total     int
	Message   string
}
