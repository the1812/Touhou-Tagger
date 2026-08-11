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

type TagPlanItem struct {
	SourcePath string
	TargetPath string
	Format     AudioFormat
	Metadata   Metadata
}

type TagPlan struct {
	Directory string
	Items     []TagPlanItem
}

type BatchJob struct {
	Directory    string
	Name         string
	PreflightErr error
	Ignored      bool
}

type BatchResult struct {
	Job      BatchJob
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
	StageCommit   EventStage = "commit"
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
