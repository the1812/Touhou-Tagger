package bridge

type StateIssue struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
	ItemID   string `json:"itemId,omitempty"`
}

type SourceOption struct {
	Value          string `json:"value"`
	Label          string `json:"label"`
	SupportsSearch bool   `json:"supportsSearch"`
}

type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type Capabilities struct {
	Sources          []SourceOption `json:"sources"`
	CommentLanguages []SelectOption `json:"commentLanguages"`
	LyricTypes       []SelectOption `json:"lyricTypes"`
}

type CoverStatus struct {
	Exists   bool        `json:"exists"`
	Valid    bool        `json:"valid"`
	FileName string      `json:"fileName,omitempty"`
	Issue    *StateIssue `json:"issue,omitempty"`
}

type WorkspaceSummary struct {
	Directory         string       `json:"directory"`
	AudioCount        int          `json:"audioCount"`
	MP3Count          int          `json:"mp3Count"`
	FLACCount         int          `json:"flacCount"`
	LocalCover        CoverStatus  `json:"localCover"`
	HasMetadataJSON   bool         `json:"hasMetadataJson"`
	HasAlbumConfig    bool         `json:"hasAlbumConfig"`
	InferredAlbumName string       `json:"inferredAlbumName"`
	EffectiveSource   string       `json:"effectiveSource"`
	Issues            []StateIssue `json:"issues"`
}

type AlbumCandidate struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Source      string   `json:"source"`
	SourceLabel string   `json:"sourceLabel"`
	AlbumOrder  string   `json:"albumOrder,omitempty"`
	Artists     []string `json:"artists"`
	Year        string   `json:"year,omitempty"`
	ExactMatch  bool     `json:"exactMatch"`
	Description string   `json:"description,omitempty"`
}

type AlbumMetadata struct {
	Title      string   `json:"title"`
	AlbumOrder string   `json:"albumOrder"`
	Artists    []string `json:"artists"`
	Year       string   `json:"year"`
	Genres     []string `json:"genres"`
}

type CoverPreview struct {
	URL                    string      `json:"url"`
	Source                 string      `json:"source"`
	SourceLabel            string      `json:"sourceLabel"`
	Width                  int         `json:"width"`
	Height                 int         `json:"height"`
	ByteSize               int         `json:"byteSize"`
	CompressionDescription string      `json:"compressionDescription"`
	Issue                  *StateIssue `json:"issue,omitempty"`
}

type PlanItemPreview struct {
	ID          string       `json:"id"`
	SourceName  string       `json:"sourceName"`
	Format      string       `json:"format"`
	DiscNumber  string       `json:"discNumber"`
	TrackNumber string       `json:"trackNumber"`
	Title       string       `json:"title"`
	Artists     []string     `json:"artists"`
	Comments    string       `json:"comments"`
	TargetName  string       `json:"targetName"`
	WillRename  bool         `json:"willRename"`
	Issues      []StateIssue `json:"issues"`
}

type PlanOptions struct {
	WriteFiles    int  `json:"writeFiles"`
	RenameFiles   int  `json:"renameFiles"`
	CanSaveCover  bool `json:"canSaveCover"`
	SaveCover     bool `json:"saveCover"`
	CompressCover bool `json:"compressCover"`
	LRCFiles      int  `json:"lrcFiles"`
}

type PlanPreview struct {
	PlanID    string            `json:"planId"`
	Revision  int               `json:"revision"`
	Directory string            `json:"directory"`
	Album     AlbumMetadata     `json:"album"`
	Candidate AlbumCandidate    `json:"candidate"`
	Cover     CoverPreview      `json:"cover"`
	Items     []PlanItemPreview `json:"items"`
	Issues    []StateIssue      `json:"issues"`
	Options   PlanOptions       `json:"options"`
	CanCommit bool              `json:"canCommit"`
}

type AlbumMetadataPatch struct {
	Title      *string   `json:"title,omitempty"`
	AlbumOrder *string   `json:"albumOrder,omitempty"`
	Artists    *[]string `json:"artists,omitempty"`
	Year       *string   `json:"year,omitempty"`
	Genres     *[]string `json:"genres,omitempty"`
}

type TrackMetadataPatch struct {
	ID          string    `json:"id"`
	DiscNumber  *string   `json:"discNumber,omitempty"`
	TrackNumber *string   `json:"trackNumber,omitempty"`
	Title       *string   `json:"title,omitempty"`
	Artists     *[]string `json:"artists,omitempty"`
	Comments    *string   `json:"comments,omitempty"`
}

type PlanPatch struct {
	PlanID    string               `json:"planId"`
	Revision  int                  `json:"revision"`
	Album     *AlbumMetadataPatch  `json:"album,omitempty"`
	Tracks    []TrackMetadataPatch `json:"tracks,omitempty"`
	SaveCover *bool                `json:"saveCover,omitempty"`
}

type OperationStart struct {
	OperationID string `json:"operationId"`
}

type OperationProgress struct {
	OperationID string `json:"operationId"`
	Kind        string `json:"kind"`
	Stage       string `json:"stage"`
	Current     int    `json:"current"`
	Total       int    `json:"total"`
	Path        string `json:"path,omitempty"`
	Message     string `json:"message"`
	MessageID   string `json:"messageId,omitempty"`
	Cancellable bool   `json:"cancellable"`
}

type OperationResult struct {
	OperationID string `json:"operationId"`
	Kind        string `json:"kind"`
	Succeeded   int    `json:"succeeded"`
	Failed      int    `json:"failed"`
	Renamed     int    `json:"renamed"`
	CoversSaved int    `json:"coversSaved"`
	LRCFiles    int    `json:"lrcFiles"`
	DurationMS  int64  `json:"durationMs"`
	Cancelled   bool   `json:"cancelled"`
	Message     string `json:"message"`
}

type OperationFailure struct {
	OperationID     string `json:"operationId"`
	Kind            string `json:"kind"`
	Message         string `json:"message"`
	Details         string `json:"details,omitempty"`
	PlanInvalidated bool   `json:"planInvalidated"`
}

type ProcessError struct {
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

type BatchJobPreview struct {
	ID                  string           `json:"id"`
	RelativePath        string           `json:"relativePath"`
	InferredAlbumName   string           `json:"inferredAlbumName"`
	Source              string           `json:"source"`
	MatchDescription    string           `json:"matchDescription"`
	AudioCount          int              `json:"audioCount"`
	Status              string           `json:"status"`
	Issues              []StateIssue     `json:"issues"`
	Candidates          []AlbumCandidate `json:"candidates"`
	SelectedCandidateID string           `json:"selectedCandidateId,omitempty"`
}

type BatchPreview struct {
	BatchID       string            `json:"batchId"`
	RootDirectory string            `json:"rootDirectory"`
	Depth         int               `json:"depth"`
	Jobs          []BatchJobPreview `json:"jobs"`
}

type BatchRunResult struct {
	OperationID string            `json:"operationId"`
	Kind        string            `json:"kind"`
	Succeeded   int               `json:"succeeded"`
	Failed      int               `json:"failed"`
	Renamed     int               `json:"renamed"`
	CoversSaved int               `json:"coversSaved"`
	LRCFiles    int               `json:"lrcFiles"`
	DurationMS  int64             `json:"durationMs"`
	Cancelled   bool              `json:"cancelled"`
	Message     string            `json:"message"`
	Jobs        []BatchJobPreview `json:"jobs"`
}

type Settings struct {
	DefaultSource               string  `json:"defaultSource"`
	CommentLanguage             string  `json:"commentLanguage"`
	MP3MultiValueSeparator      string  `json:"mp3MultiValueSeparator"`
	RequestTimeoutSeconds       int     `json:"requestTimeoutSeconds"`
	RetryCount                  int     `json:"retryCount"`
	CoverCompressionThresholdKB float64 `json:"coverCompressionThresholdKb"`
	CoverMaxEdge                int     `json:"coverMaxEdge"`
	LyricType                   string  `json:"lyricType"`
	WriteLyricsMetadata         bool    `json:"writeLyricsMetadata"`
	WriteLRCFiles               bool    `json:"writeLrcFiles"`
	PreserveLyricTimeline       bool    `json:"preserveLyricTimeline"`
	MixedLyricSeparator         string  `json:"mixedLyricSeparator"`
	LyricCacheSize              int     `json:"lyricCacheSize"`
}

func dtoSlice[T any](values []T) []T {
	result := make([]T, len(values))
	copy(result, values)
	return result
}
