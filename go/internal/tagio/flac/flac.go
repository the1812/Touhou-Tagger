package flac

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"io"
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
	options tagio.ReadOptions,
) (result tagio.ReadResult, resultErr error) {
	if err := ctx.Err(); err != nil {
		return result, err
	}
	input, err := os.Open(path)
	if err != nil {
		return result, err
	}
	defer func() { resultErr = errors.Join(resultErr, input.Close()) }()
	file, err := parseMetadata(bufio.NewReader(input))
	if err != nil {
		return result, fmt.Errorf("parse FLAC %q: %w", path, err)
	}
	comments := flacvorbis.New()
	var cover []byte
	var raw []any
	if options.IncludeRaw {
		raw = make([]any, 0, len(file.Meta))
	}
	for _, block := range file.Meta {
		var data any
		if options.IncludeRaw {
			data = fmt.Sprintf("<Buffer length=%d>", len(block.Data))
		}
		switch block.Type {
		case flacfile.VorbisComment:
			parsed, err := flacvorbis.ParseFromMetaDataBlock(*block)
			if err != nil {
				return result, fmt.Errorf("parse FLAC comments %q: %w", path, err)
			}
			comments = parsed
			if options.IncludeRaw {
				data = map[string]any{"vendor": comments.Vendor, "comments": comments.Comments}
			}
		case flacfile.Picture:
			picture, err := flacpicture.ParseFromMetaDataBlock(*block)
			if err != nil {
				return result, fmt.Errorf("parse FLAC picture %q: %w", path, err)
			}
			if picture.PictureType == flacpicture.PictureTypeFrontCover && len(cover) == 0 {
				cover = picture.ImageData
			}
			if options.IncludeRaw {
				data = map[string]any{
					"pictureType": picture.PictureType, "mimeType": picture.MIME,
					"description": picture.Description, "width": picture.Width, "height": picture.Height,
					"colorDepth": picture.ColorDepth, "indexedColorCount": picture.IndexedColorCount,
					"imageData": fmt.Sprintf("<Buffer length=%d>", len(picture.ImageData)),
				}
			}
		case flacfile.StreamInfo, flacfile.Padding, flacfile.Application, flacfile.SeekTable,
			flacfile.CueSheet, flacfile.Reserved:
		case flacfile.Invalid:
			return result, fmt.Errorf("parse FLAC %q: invalid metadata block type", path)
		}
		if options.IncludeRaw {
			raw = append(raw, map[string]any{"type": block.Type, "data": data})
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
	result.Metadata = domain.Metadata{
		Title: value("TITLE"), Artists: values("ARTIST"), Album: value("ALBUM"),
		AlbumOrder: value("ALBUMSORT"), DiscNumber: value("DISCNUMBER"), TrackNumber: value("TRACKNUMBER"),
		Composers: values("COMPOSER"), Genres: values("GENRE"), Year: value("DATE"),
		Lyricists: values("LYRICIST"), AlbumArtists: values("ALBUMARTIST"), Comments: value("COMMENT"),
		Lyric: value("LYRICS"), BPM: value("BPM"), Key: value("KEY"), CoverImage: cover,
	}
	if options.IncludeRaw {
		result.Raw = raw
	}
	return result, nil
}

func parseMetadata(reader io.Reader) (*flacfile.File, error) {
	file, err := flacfile.ParseMetadata(reader)
	if err != nil {
		return nil, err
	}
	var frame [2]byte
	if _, err := io.ReadFull(reader, frame[:]); err != nil {
		return nil, err
	}
	if frame[0] != 0xff || frame[1]>>2 != 0x3e {
		return nil, flacfile.ErrorNoSyncCode
	}
	return file, nil
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
		return fmt.Errorf("prepare FLAC cover for %q: %w", path, err)
	}
	target, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return err
	}
	defer func() { resultErr = errors.Join(resultErr, target.Close()) }()
	file, err := parseMetadata(bufio.NewReader(target))
	if err != nil {
		return fmt.Errorf("parse FLAC %q: %w", path, err)
	}
	audioOffset := metadataSize(file.Meta)
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
		case flacfile.Padding:
		case flacfile.StreamInfo, flacfile.Application, flacfile.SeekTable,
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
		mime := http.DetectContentType(cover)
		depth := uint32(24)
		switch mime {
		case "image/jpeg":
		case "image/png":
			depth = 32
		default:
			return fmt.Errorf("create FLAC cover %q: %w", path, flacpicture.ErrorUnsupportedMIME)
		}
		dimensions, _, err := image.DecodeConfig(bytes.NewReader(cover))
		if err != nil {
			return fmt.Errorf("read FLAC cover dimensions %q: %w", path, err)
		}
		picture := flacpicture.MetadataBlockPicture{
			PictureType: flacpicture.PictureTypeFrontCover,
			Description: metadata.Album, MIME: mime, ImageData: cover,
			Width: uint32(dimensions.Width), Height: uint32(dimensions.Height), ColorDepth: depth,
		}
		pictureBlock := picture.Marshal()
		newMeta = append(newMeta, &pictureBlock)
	}
	file.Meta = newMeta
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := writeMetadata(target, file, audioOffset); err != nil {
		return fmt.Errorf("save FLAC %q: %w", path, err)
	}
	return nil
}

func metadataSize(blocks []*flacfile.MetaDataBlock) int64 {
	size := int64(4)
	for _, block := range blocks {
		size += 4 + int64(len(block.Data))
	}
	return size
}

func writeMetadata(target *os.File, file *flacfile.File, audioOffset int64) error {
	const maxBlockSize = 1<<24 - 1
	for _, block := range file.Meta {
		if len(block.Data) > maxBlockSize {
			return fmt.Errorf("FLAC metadata block exceeds 24-bit size: %d", len(block.Data))
		}
	}
	remaining := audioOffset - metadataSize(file.Meta)
	for remaining >= 4 {
		size := min(remaining-4, maxBlockSize)
		if tail := remaining - size - 4; tail > 0 && tail < 4 {
			size -= 4 - tail
		}
		file.Meta = append(file.Meta, &flacfile.MetaDataBlock{Type: flacfile.Padding, Data: make([]byte, int(size))})
		remaining -= size + 4
	}
	header := file.Marshal()
	shift := int64(len(header)) - audioOffset
	if shift != 0 {
		info, err := target.Stat()
		if err != nil {
			return err
		}
		buffer := make([]byte, 1024*1024)
		length := info.Size() - audioOffset
		for copied := int64(0); copied < length; {
			size := min(int64(len(buffer)), length-copied)
			offset := audioOffset + copied
			if shift > 0 {
				offset = info.Size() - copied - size
			}
			chunk := buffer[:int(size)]
			if _, err := target.ReadAt(chunk, offset); err != nil {
				return err
			}
			if _, err := target.WriteAt(chunk, offset+shift); err != nil {
				return err
			}
			copied += size
		}
		if err := target.Truncate(info.Size() + shift); err != nil {
			return err
		}
	}
	_, err := target.WriteAt(header, 0)
	return err
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
