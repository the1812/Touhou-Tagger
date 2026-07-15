package flac

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/go-flac/flacpicture"
	"github.com/go-flac/flacvorbis"
	flacfile "github.com/go-flac/go-flac"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

type Reader struct{}

type Writer struct {
	CoverProcessor tagio.CoverProcessor
}

func (Reader) Read(
	ctx context.Context,
	path string,
	_ domain.MetadataConfig,
) (domain.Metadata, error) {
	if err := ctx.Err(); err != nil {
		return domain.Metadata{}, err
	}
	file, err := flacfile.ParseFile(path)
	if err != nil {
		return domain.Metadata{}, fmt.Errorf("parse FLAC %q: %w", path, err)
	}
	comments := flacvorbis.New()
	var cover []byte
	for _, block := range file.Meta {
		switch block.Type {
		case flacfile.VorbisComment:
			parsed, parseErr := flacvorbis.ParseFromMetaDataBlock(*block)
			if parseErr != nil {
				return domain.Metadata{}, fmt.Errorf("parse FLAC comments %q: %w", path, parseErr)
			}
			comments = parsed
		case flacfile.Picture:
			picture, parseErr := flacpicture.ParseFromMetaDataBlock(*block)
			if parseErr != nil {
				return domain.Metadata{}, fmt.Errorf("parse FLAC picture %q: %w", path, parseErr)
			}
			if picture.PictureType == flacpicture.PictureTypeFrontCover && len(cover) == 0 {
				cover = append([]byte(nil), picture.ImageData...)
			}
		case flacfile.StreamInfo, flacfile.Padding, flacfile.Application, flacfile.SeekTable,
			flacfile.CueSheet, flacfile.Reserved:
		case flacfile.Invalid:
			return domain.Metadata{}, fmt.Errorf("parse FLAC %q: invalid metadata block type", path)
		}
	}
	value := func(key string) string {
		values, getErr := comments.Get(key)
		if getErr != nil || len(values) == 0 {
			return ""
		}
		return values[0]
	}
	values := func(key string) []string {
		result, getErr := comments.Get(key)
		if getErr != nil || len(result) == 0 {
			return nil
		}
		return result
	}
	return domain.Metadata{
		Title:        value("TITLE"),
		Artists:      values("ARTIST"),
		Album:        value("ALBUM"),
		AlbumOrder:   value("ALBUMSORT"),
		DiscNumber:   value("DISCNUMBER"),
		TrackNumber:  value("TRACKNUMBER"),
		Composers:    values("COMPOSER"),
		Genres:       values("GENRE"),
		Year:         value("DATE"),
		Lyricists:    values("LYRICIST"),
		AlbumArtists: values("ALBUMARTIST"),
		Comments:     value("COMMENT"),
		Lyric:        value("LYRICS"),
		BPM:          value("BPM"),
		Key:          value("KEY"),
		CoverImage:   cover,
	}, nil
}

func (writer Writer) Write(
	ctx context.Context,
	path string,
	metadata domain.Metadata,
	config domain.MetadataConfig,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	cover, err := tagio.ProcessCover(ctx, writer.CoverProcessor, metadata.CoverImage, config)
	if err != nil {
		return fmt.Errorf("prepare FLAC cover for %q: %w", path, err)
	}
	file, err := flacfile.ParseFile(path)
	if err != nil {
		return fmt.Errorf("parse FLAC %q: %w", path, err)
	}
	comments := flacvorbis.New()
	newMeta := make([]*flacfile.MetaDataBlock, 0, len(file.Meta)+2)
	for _, block := range file.Meta {
		switch block.Type {
		case flacfile.VorbisComment:
			parsed, parseErr := flacvorbis.ParseFromMetaDataBlock(*block)
			if parseErr != nil {
				return fmt.Errorf("parse FLAC comments %q: %w", path, parseErr)
			}
			comments = parsed
		case flacfile.Picture:
			picture, parseErr := flacpicture.ParseFromMetaDataBlock(*block)
			if parseErr != nil {
				return fmt.Errorf("parse FLAC picture %q: %w", path, parseErr)
			}
			if picture.PictureType != flacpicture.PictureTypeFrontCover {
				newMeta = append(newMeta, block)
			}
		case flacfile.StreamInfo, flacfile.Padding, flacfile.Application, flacfile.SeekTable,
			flacfile.CueSheet, flacfile.Reserved:
			newMeta = append(newMeta, block)
		case flacfile.Invalid:
			return fmt.Errorf("parse FLAC %q: invalid metadata block type", path)
		}
	}
	comments.Comments = retainUnknownComments(comments.Comments)
	fields := map[string][]string{
		"ARTIST":      metadata.Artists,
		"TITLE":       {metadata.Title},
		"ALBUM":       {metadata.Album},
		"ALBUMSORT":   {metadata.AlbumOrder},
		"TRACKNUMBER": {metadata.TrackNumber},
		"DISCNUMBER":  {metadata.DiscNumber},
		"COMPOSER":    metadata.Composers,
		"COMMENT":     {metadata.Comments},
		"LYRICIST":    metadata.Lyricists,
		"ALBUMARTIST": metadata.AlbumArtists,
		"GENRE":       metadata.Genres,
		"DATE":        {metadata.Year},
		"BPM":         {metadata.BPM},
		"KEY":         {metadata.Key},
	}
	if config.Lyric == nil || config.Lyric.Output != domain.LyricLRC {
		fields["LYRICS"] = []string{metadata.Lyric}
	}
	for key, fieldValues := range fields {
		for _, value := range fieldValues {
			if value != "" {
				if err := comments.Add(key, value); err != nil {
					return fmt.Errorf("add FLAC field %s for %q: %w", key, path, err)
				}
			}
		}
	}
	commentBlock := comments.Marshal()
	newMeta = append(newMeta, &commentBlock)
	if len(cover) > 0 {
		picture, pictureErr := flacpicture.NewFromImageData(
			flacpicture.PictureTypeFrontCover,
			metadata.Album,
			cover,
			http.DetectContentType(cover),
		)
		if pictureErr != nil {
			return fmt.Errorf("create FLAC cover %q: %w", path, pictureErr)
		}
		pictureBlock := picture.Marshal()
		newMeta = append(newMeta, &pictureBlock)
	}
	file.Meta = newMeta
	if err := ctx.Err(); err != nil {
		return err
	}
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("stat FLAC %q: %w", path, err)
	}
	if err := os.WriteFile(path, file.Marshal(), info.Mode()); err != nil {
		return fmt.Errorf("save FLAC %q: %w", path, err)
	}
	return nil
}

var ownedCommentKeys = map[string]struct{}{
	"ARTIST": {}, "TITLE": {}, "ALBUM": {}, "ALBUMSORT": {}, "TRACKNUMBER": {},
	"DISCNUMBER": {}, "COMPOSER": {}, "COMMENT": {}, "LYRICS": {}, "LYRICIST": {},
	"ALBUMARTIST": {}, "GENRE": {}, "DATE": {}, "BPM": {}, "KEY": {},
}

func retainUnknownComments(comments []string) []string {
	retained := comments[:0]
	for _, comment := range comments {
		key, _, found := strings.Cut(comment, "=")
		if !found {
			continue
		}
		if _, owned := ownedCommentKeys[strings.ToUpper(key)]; !owned {
			retained = append(retained, comment)
		}
	}
	return retained
}
