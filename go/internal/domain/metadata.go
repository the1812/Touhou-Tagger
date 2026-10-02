package domain

import (
	"maps"
	"slices"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/text/unicode/norm"
)

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

func (metadata Metadata) Clone() Metadata {
	metadata.AlbumArtists = slices.Clone(metadata.AlbumArtists)
	metadata.Genres = slices.Clone(metadata.Genres)
	metadata.Artists = slices.Clone(metadata.Artists)
	metadata.Composers = slices.Clone(metadata.Composers)
	metadata.Lyricists = slices.Clone(metadata.Lyricists)
	metadata.ExtraData = maps.Clone(metadata.ExtraData)
	return metadata
}

func (metadata Metadata) WithoutCover() Metadata {
	metadata.CoverImage = nil
	return metadata
}

type AlbumCandidate struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Source       string   `json:"source"`
	Artists      []string `json:"artists,omitempty"`
	ThumbnailURL string   `json:"thumbnailUrl,omitempty"`
	Description  string   `json:"description,omitempty"`
}

func MatchingAlbumCandidate(candidates []AlbumCandidate, query string) *AlbumCandidate {
	var match *AlbumCandidate
	for index := range candidates {
		if !candidates[index].MatchesName(query) {
			continue
		}
		if match != nil {
			return nil
		}
		match = &candidates[index]
	}
	return match
}

func (candidate AlbumCandidate) MatchesName(query string) bool {
	lower := cases.Lower(language.Und)
	return strings.TrimSpace(lower.String(norm.NFKC.String(candidate.Name))) ==
		strings.TrimSpace(lower.String(norm.NFKC.String(query)))
}
