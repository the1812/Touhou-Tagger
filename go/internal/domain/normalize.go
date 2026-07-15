package domain

import (
	"strconv"
	"strings"
	"unicode"
)

func ExpandMetadata(metadata []Metadata, cover []byte) []Metadata {
	if len(metadata) == 0 {
		return metadata
	}
	track := 1
	disc := 1
	first := metadata[0]
	for index := range metadata {
		item := &metadata[index]
		if parsed, ok := parseMetadataNumber(item.DiscNumber); ok && parsed != disc {
			disc = parsed
			track = 1
		}
		if item.DiscNumber == "" {
			item.DiscNumber = strconv.Itoa(disc)
		}
		if item.TrackNumber == "" {
			item.TrackNumber = strconv.Itoa(track)
		}
		track++
		if len(item.Artists) == 0 && len(item.Composers) > 0 {
			item.Artists = append([]string(nil), item.Composers...)
		}
		if index > 0 {
			fillAlbumFields(item, first)
		}
		if len(item.CoverImage) == 0 && len(cover) > 0 {
			item.CoverImage = cover
		}
	}
	if len(metadata[0].CoverImage) == 0 && len(cover) > 0 {
		metadata[0].CoverImage = cover
	}
	return metadata
}

func fillAlbumFields(item *Metadata, first Metadata) {
	if item.Album == "" {
		item.Album = first.Album
	}
	if item.AlbumOrder == "" {
		item.AlbumOrder = first.AlbumOrder
	}
	if len(item.AlbumArtists) == 0 {
		item.AlbumArtists = append([]string(nil), first.AlbumArtists...)
	}
	if len(item.Genres) == 0 {
		item.Genres = append([]string(nil), first.Genres...)
	}
	if item.Year == "" {
		item.Year = first.Year
	}
	if len(item.CoverImage) == 0 {
		item.CoverImage = first.CoverImage
	}
}

func SimplifyMetadata(metadata []Metadata) []Metadata {
	if len(metadata) == 0 {
		return metadata
	}
	track := 1
	disc := 1
	first := metadata[0]
	for index := range metadata {
		item := &metadata[index]
		if item.DiscNumber != "" {
			parsed, ok := parseMetadataNumber(item.DiscNumber)
			if !ok || parsed == disc {
				item.DiscNumber = ""
			} else {
				disc = parsed
				track = 1
			}
		}
		if item.TrackNumber != "" {
			parsed, ok := parseMetadataNumber(item.TrackNumber)
			if !ok || parsed == track {
				item.TrackNumber = ""
			}
		}
		track++
		if index > 0 {
			clearMatchingAlbumFields(item, first)
		}
	}
	return metadata
}

func parseMetadataNumber(value string) (int, bool) {
	value = strings.TrimLeftFunc(value, unicode.IsSpace)
	end := 0
	if end < len(value) && (value[end] == '+' || value[end] == '-') {
		end++
	}
	digitStart := end
	for end < len(value) && value[end] >= '0' && value[end] <= '9' {
		end++
	}
	if end == digitStart {
		return 0, false
	}
	parsed, err := strconv.Atoi(value[:end])
	return parsed, err == nil
}

func clearMatchingAlbumFields(item *Metadata, first Metadata) {
	if item.Album == first.Album {
		item.Album = ""
	}
	if item.AlbumOrder == first.AlbumOrder {
		item.AlbumOrder = ""
	}
	if equalStrings(item.AlbumArtists, first.AlbumArtists) {
		item.AlbumArtists = nil
	}
	if equalStrings(item.Genres, first.Genres) {
		item.Genres = nil
	}
	if item.Year == first.Year {
		item.Year = ""
	}
	item.CoverImage = nil
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
