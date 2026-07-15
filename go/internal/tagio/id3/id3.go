package id3

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	id3v2 "github.com/bogem/id3v2/v2"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

type Reader struct{}

type Writer struct {
	CoverProcessor tagio.CoverProcessor
}

const albumSortFrameID = "TSOA"

func (Reader) Read(
	ctx context.Context,
	path string,
	config domain.MetadataConfig,
) (result domain.Metadata, resultErr error) {
	if err := ctx.Err(); err != nil {
		return domain.Metadata{}, err
	}
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return domain.Metadata{}, fmt.Errorf("open ID3 tag %q: %w", path, err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, tag.Close())
	}()
	metadata := domain.Metadata{
		Title:        tag.Title(),
		Artists:      split(tag.Artist(), config.Separator),
		Album:        tag.Album(),
		AlbumOrder:   tag.GetTextFrame(albumSortFrameID).Text,
		DiscNumber:   text(tag, "Part of a set"),
		TrackNumber:  text(tag, "Track number/Position in set"),
		Composers:    splitOptional(text(tag, "Composer"), config.Separator),
		Genres:       splitOptional(tag.Genre(), config.Separator),
		Year:         tag.Year(),
		Lyricists:    splitOptional(text(tag, "Lyricist/Text writer"), config.Separator),
		AlbumArtists: splitOptional(text(tag, "Band/Orchestra/Accompaniment"), config.Separator),
		BPM:          text(tag, "BPM"),
		Key:          text(tag, "Initial key"),
	}
	if frames := tag.GetFrames(tag.CommonID("Comments")); len(frames) > 0 {
		var selected id3v2.CommentFrame
		for _, frame := range frames {
			comment, ok := frame.(id3v2.CommentFrame)
			if !ok {
				return domain.Metadata{}, fmt.Errorf("read ID3 comments from %q: unexpected frame type %T", path, frame)
			}
			selected = comment
			if comment.Language == config.CommentLanguage && comment.Description == "" {
				break
			}
		}
		metadata.Comments = selected.Text
	}
	if frames := tag.GetFrames(tag.CommonID("Unsynchronised lyrics/text transcription")); len(frames) > 0 {
		var selected id3v2.UnsynchronisedLyricsFrame
		for _, frame := range frames {
			lyrics, ok := frame.(id3v2.UnsynchronisedLyricsFrame)
			if !ok {
				return domain.Metadata{}, fmt.Errorf("read ID3 lyrics from %q: unexpected frame type %T", path, frame)
			}
			if selected.Lyrics == "" || lyrics.ContentDescriptor == "" {
				selected = lyrics
			}
		}
		metadata.Lyric = selected.Lyrics
		metadata.LyricLanguage = fromID3Language(selected.Language)
	}
	var fallbackCover []byte
	for _, frame := range tag.GetFrames(tag.CommonID("Attached picture")) {
		picture, ok := frame.(id3v2.PictureFrame)
		if !ok {
			return domain.Metadata{}, fmt.Errorf("read ID3 picture from %q: unexpected frame type %T", path, frame)
		}
		if picture.PictureType == id3v2.PTFrontCover {
			fallbackCover = append([]byte(nil), picture.Picture...)
			if picture.Description == "" {
				metadata.CoverImage = fallbackCover
				break
			}
		}
	}
	if len(metadata.CoverImage) == 0 {
		metadata.CoverImage = fallbackCover
	}
	return metadata, nil
}

func (writer Writer) Write(
	ctx context.Context,
	path string,
	metadata domain.Metadata,
	config domain.MetadataConfig,
) (resultErr error) {
	if err := ctx.Err(); err != nil {
		return err
	}
	cover, err := tagio.ProcessCover(ctx, writer.CoverProcessor, metadata.CoverImage, config)
	if err != nil {
		return fmt.Errorf("prepare ID3 cover for %q: %w", path, err)
	}
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return fmt.Errorf("open ID3 tag %q: %w", path, err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, tag.Close())
	}()
	encoding := id3v2.EncodingUTF8
	if tag.Version() == 3 {
		encoding = id3v2.EncodingUTF16
	}
	tag.SetDefaultEncoding(encoding)
	lyricLanguage := toID3Language(metadata.LyricLanguage)
	clearOwnedFrames(tag, config.CommentLanguage, lyricLanguage)
	tag.SetTitle(metadata.Title)
	tag.SetArtist(strings.Join(metadata.Artists, config.Separator))
	tag.SetAlbum(metadata.Album)
	if metadata.AlbumOrder != "" {
		tag.AddTextFrame(albumSortFrameID, encoding, metadata.AlbumOrder)
	}
	setText(tag, "Part of a set", metadata.DiscNumber, encoding)
	setText(tag, "Track number/Position in set", metadata.TrackNumber, encoding)
	setText(tag, "Composer", strings.Join(metadata.Composers, config.Separator), encoding)
	tag.SetGenre(strings.Join(metadata.Genres, config.Separator))
	tag.SetYear(metadata.Year)
	setText(tag, "Lyricist/Text writer", strings.Join(metadata.Lyricists, config.Separator), encoding)
	setText(tag, "Band/Orchestra/Accompaniment", strings.Join(metadata.AlbumArtists, config.Separator), encoding)
	setText(tag, "BPM", metadata.BPM, encoding)
	setText(tag, "Initial key", metadata.Key, encoding)
	if metadata.Comments != "" {
		tag.AddCommentFrame(id3v2.CommentFrame{
			Encoding: encoding,
			Language: config.CommentLanguage,
			Text:     metadata.Comments,
		})
	}
	if metadata.Lyric != "" && (config.Lyric == nil || config.Lyric.Output != domain.LyricLRC) {
		tag.AddUnsynchronisedLyricsFrame(id3v2.UnsynchronisedLyricsFrame{
			Encoding: encoding,
			Language: lyricLanguage,
			Lyrics:   metadata.Lyric,
		})
	}
	if len(cover) > 0 {
		tag.AddAttachedPicture(id3v2.PictureFrame{
			Encoding:    id3v2.EncodingISO,
			MimeType:    http.DetectContentType(cover),
			PictureType: id3v2.PTFrontCover,
			Description: "",
			Picture:     cover,
		})
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := tag.Save(); err != nil {
		return fmt.Errorf("save ID3 tag %q: %w", path, err)
	}
	return nil
}

func clearOwnedFrames(tag *id3v2.Tag, commentLanguage, lyricLanguage string) {
	tag.DeleteFrames(albumSortFrameID)
	descriptions := []string{
		"Title", "Artist", "Album/Movie/Show title", "Part of a set",
		"Track number/Position in set", "Composer", "Content type", "Year",
		"Lyricist/Text writer", "Band/Orchestra/Accompaniment", "BPM", "Initial key",
	}
	for _, description := range descriptions {
		tag.DeleteFrames(tag.CommonID(description))
	}
	retainFrames(tag, tag.CommonID("Comments"), func(frame id3v2.Framer) bool {
		comment, ok := frame.(id3v2.CommentFrame)
		return !ok || comment.Language != commentLanguage || comment.Description != ""
	})
	retainFrames(tag, tag.CommonID("Unsynchronised lyrics/text transcription"), func(frame id3v2.Framer) bool {
		lyrics, ok := frame.(id3v2.UnsynchronisedLyricsFrame)
		return !ok || lyrics.Language != lyricLanguage || lyrics.ContentDescriptor != ""
	})
	retainFrames(tag, tag.CommonID("Attached picture"), func(frame id3v2.Framer) bool {
		picture, ok := frame.(id3v2.PictureFrame)
		return !ok || picture.PictureType != id3v2.PTFrontCover || picture.Description != ""
	})
}

func retainFrames(tag *id3v2.Tag, id string, keep func(id3v2.Framer) bool) {
	frames := tag.GetFrames(id)
	tag.DeleteFrames(id)
	for _, frame := range frames {
		if keep(frame) {
			tag.AddFrame(id, frame)
		}
	}
}

func setText(tag *id3v2.Tag, description, value string, encoding id3v2.Encoding) {
	if value != "" {
		tag.AddTextFrame(tag.CommonID(description), encoding, value)
	}
}

func text(tag *id3v2.Tag, description string) string {
	return tag.GetTextFrame(tag.CommonID(description)).Text
}

func split(value, separator string) []string {
	if value == "" {
		return []string{}
	}
	return strings.Split(value, separator)
}

func splitOptional(value, separator string) []string {
	if value == "" {
		return nil
	}
	return strings.Split(value, separator)
}

func fromID3Language(value string) string {
	switch value {
	case "deu":
		return "de"
	case "zho":
		return "zh"
	default:
		return "ja"
	}
}

func toID3Language(value string) string {
	switch value {
	case "de":
		return "deu"
	case "zh":
		return "zho"
	default:
		return "jpn"
	}
}
