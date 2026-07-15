package domain

type Metadata struct {
	Album         string         `json:"album,omitempty"`
	AlbumOrder    string         `json:"albumOrder,omitempty"`
	AlbumArtists  []string       `json:"albumArtists,omitempty"`
	Genres        []string       `json:"genres,omitempty"`
	Year          string         `json:"year,omitempty"`
	CoverImage    []byte         `json:"coverImage,omitempty"`
	ExtraData     map[string]any `json:"extraData,omitempty"`
	Title         string         `json:"title"`
	Artists       []string       `json:"artists"`
	DiscNumber    string         `json:"discNumber,omitempty"`
	TrackNumber   string         `json:"trackNumber,omitempty"`
	Composers     []string       `json:"composers,omitempty"`
	Comments      string         `json:"comments,omitempty"`
	LyricLanguage string         `json:"lyricLanguage,omitempty"`
	Lyric         string         `json:"lyric,omitempty"`
	Lyricists     []string       `json:"lyricists,omitempty"`
	BPM           string         `json:"bpm,omitempty"`
	Key           string         `json:"key,omitempty"`
}

func (metadata Metadata) WithoutCover() Metadata {
	metadata.CoverImage = nil
	return metadata
}

type AlbumCandidate struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Source string `json:"source"`
}
