package tagio_test

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	id3v2 "github.com/bogem/id3v2/v2"
	"github.com/go-flac/flacvorbis"
	flacfile "github.com/go-flac/go-flac"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
	flactag "github.com/the1812/Touhou-Tagger/go/internal/tagio/flac"
	id3tag "github.com/the1812/Touhou-Tagger/go/internal/tagio/id3"
	"github.com/the1812/Touhou-Tagger/go/internal/testutil"
)

func TestMetadataRoundTrip(t *testing.T) {
	cover := testutil.ReadFixture(t, "media", "images", "cover.jpg")
	expected := domain.Metadata{
		Title: "Test Title", Artists: []string{"Artist One", "Artist Two"},
		Album: "Test Album", AlbumOrder: "TEST-001", AlbumArtists: []string{"Album Artist"},
		Genres: []string{"Rock", "Game"}, Year: "2026", DiscNumber: "1", TrackNumber: "1",
		Composers: []string{"Composer One"}, Comments: "Test Comment", LyricLanguage: "ja",
		Lyric: "Test lyric line", Lyricists: []string{"Lyricist One"}, BPM: "128", Key: "Am",
		CoverImage: cover,
	}
	config := domain.DefaultMetadataConfig()
	config.Lyric = func() *domain.LyricConfig {
		value := domain.DefaultLyricConfig()
		return &value
	}()
	tests := []struct {
		name        string
		fixturePath []string
		extension   string
		writer      tagio.Writer
		reader      tagio.Reader
	}{
		{
			name: "mp3", fixturePath: []string{"media", "mp3", "audio-blank.mp3"}, extension: ".mp3",
			writer: id3tag.Writer{}, reader: id3tag.Reader{},
		},
		{
			name: "flac", fixturePath: []string{"media", "flac", "audio-blank.flac"}, extension: ".flac",
			writer: flactag.Writer{}, reader: flactag.Reader{},
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "roundtrip"+testCase.extension)
			if err := os.WriteFile(path, testutil.ReadFixture(t, testCase.fixturePath...), 0o644); err != nil {
				t.Fatal(err)
			}
			if err := testCase.writer.Write(context.Background(), path, expected, config); err != nil {
				t.Fatal(err)
			}
			actual, err := testCase.reader.Read(context.Background(), path, config)
			if err != nil {
				t.Fatal(err)
			}
			if testCase.name == "flac" {
				actual.LyricLanguage = expected.LyricLanguage
			}
			if !reflect.DeepEqual(actual, expected) {
				t.Fatalf("metadata mismatch\ngot:  %#v\nwant: %#v", actual, expected)
			}
		})
	}
}

func TestID3WriterPreservesUnownedFrames(t *testing.T) {
	path := filepath.Join(t.TempDir(), "preserve.mp3")
	if err := os.WriteFile(path, testutil.ReadFixture(t, "media", "mp3", "audio-blank.mp3"), 0o644); err != nil {
		t.Fatal(err)
	}
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		t.Fatal(err)
	}
	tag.AddUserDefinedTextFrame(id3v2.UserDefinedTextFrame{
		Encoding: id3v2.EncodingUTF8, Description: "preserve-me", Value: "kept",
	})
	tag.AddFrame("XABC", id3v2.UnknownFrame{Body: []byte{0x10, 0x20, 0x30}})
	tag.AddCommentFrame(id3v2.CommentFrame{
		Encoding: id3v2.EncodingUTF8, Language: "eng", Description: "review", Text: "keep comment",
	})
	tag.AddUnsynchronisedLyricsFrame(id3v2.UnsynchronisedLyricsFrame{
		Encoding: id3v2.EncodingUTF8, Language: "eng", ContentDescriptor: "karaoke", Lyrics: "keep lyric",
	})
	tag.AddAttachedPicture(id3v2.PictureFrame{
		Encoding: id3v2.EncodingISO, MimeType: "image/jpeg", PictureType: id3v2.PTBackCover,
		Description: "back", Picture: []byte{0xff, 0xd8, 0xff, 0xd9},
	})
	if err := tag.Save(); err != nil {
		t.Fatal(err)
	}
	if err := tag.Close(); err != nil {
		t.Fatal(err)
	}
	metadata := domain.Metadata{
		Title: "Title", Artists: []string{"Artist"}, Album: "Album", DiscNumber: "1", TrackNumber: "1",
	}
	if err := (id3tag.Writer{}).Write(context.Background(), path, metadata, domain.DefaultMetadataConfig()); err != nil {
		t.Fatal(err)
	}
	tag, err = id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := tag.Close(); err != nil {
			t.Error(err)
		}
	}()
	frames := tag.GetFrames(tag.CommonID("User defined text information frame"))
	if len(frames) != 1 {
		t.Fatalf("got %d user-defined frames, want 1", len(frames))
	}
	frame, ok := frames[0].(id3v2.UserDefinedTextFrame)
	if !ok {
		t.Fatalf("unexpected frame type: %T", frames[0])
	}
	if frame.Description != "preserve-me" || frame.Value != "kept" {
		t.Fatalf("unexpected retained frame: %#v", frame)
	}
	unknownFrames := tag.GetFrames("XABC")
	if len(unknownFrames) != 1 {
		t.Fatalf("got %d unknown frames, want 1", len(unknownFrames))
	}
	unknown, ok := unknownFrames[0].(id3v2.UnknownFrame)
	if !ok || !bytes.Equal(unknown.Body, []byte{0x10, 0x20, 0x30}) {
		t.Fatalf("unexpected retained unknown frame: %#v", unknownFrames[0])
	}
	assertFramePreserved(t, tag.GetFrames(tag.CommonID("Comments")), func(frame id3v2.Framer) bool {
		comment, ok := frame.(id3v2.CommentFrame)
		return ok && comment.Language == "eng" && comment.Description == "review" && comment.Text == "keep comment"
	})
	assertFramePreserved(t, tag.GetFrames(tag.CommonID("Unsynchronised lyrics/text transcription")), func(frame id3v2.Framer) bool {
		lyrics, ok := frame.(id3v2.UnsynchronisedLyricsFrame)
		return ok && lyrics.Language == "eng" && lyrics.ContentDescriptor == "karaoke" && lyrics.Lyrics == "keep lyric"
	})
	assertFramePreserved(t, tag.GetFrames(tag.CommonID("Attached picture")), func(frame id3v2.Framer) bool {
		picture, ok := frame.(id3v2.PictureFrame)
		return ok && picture.PictureType == id3v2.PTBackCover && picture.Description == "back"
	})
}

func TestID3WriterSupportsVersion23AlbumOrder(t *testing.T) {
	path := filepath.Join(t.TempDir(), "version-23.mp3")
	if err := os.WriteFile(path, testutil.ReadFixture(t, "media", "mp3", "audio-blank.mp3"), 0o644); err != nil {
		t.Fatal(err)
	}
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		t.Fatal(err)
	}
	tag.SetVersion(3)
	tag.SetDefaultEncoding(id3v2.EncodingUTF16)
	tag.SetTitle("Before")
	if err = tag.Save(); err != nil {
		t.Fatal(err)
	}
	if err = tag.Close(); err != nil {
		t.Fatal(err)
	}

	metadata := domain.Metadata{
		Title: "Title", Artists: []string{"Artist"}, Album: "Album", AlbumOrder: "SORT-001",
		DiscNumber: "1", TrackNumber: "1", CoverImage: testutil.ReadFixture(t, "media", "images", "cover.jpg"),
	}
	config := domain.DefaultMetadataConfig()
	if err = (id3tag.Writer{}).Write(context.Background(), path, metadata, config); err != nil {
		t.Fatal(err)
	}
	tag, err = id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := tag.Close(); err != nil {
			t.Error(err)
		}
	}()
	if tag.Version() != 3 {
		t.Fatalf("tag version = %d, want 3", tag.Version())
	}
	if albumOrder := tag.GetTextFrame("TSOA").Text; albumOrder != metadata.AlbumOrder {
		t.Fatalf("album order = %q, want %q", albumOrder, metadata.AlbumOrder)
	}
	pictures := tag.GetFrames(tag.CommonID("Attached picture"))
	if len(pictures) != 1 {
		t.Fatalf("picture frames = %d, want 1", len(pictures))
	}
	picture, ok := pictures[0].(id3v2.PictureFrame)
	if !ok {
		t.Fatalf("unexpected picture frame type: %T", pictures[0])
	}
	if picture.Encoding.Key != id3v2.EncodingISO.Key || picture.Description != "" {
		t.Fatalf("front cover encoding = %d and description = %q, want ISO with an empty description", picture.Encoding.Key, picture.Description)
	}
	actual, err := (id3tag.Reader{}).Read(context.Background(), path, config)
	if err != nil {
		t.Fatal(err)
	}
	if actual.AlbumOrder != metadata.AlbumOrder {
		t.Fatalf("reader album order = %q, want %q", actual.AlbumOrder, metadata.AlbumOrder)
	}
}

func assertFramePreserved(t *testing.T, frames []id3v2.Framer, matches func(id3v2.Framer) bool) {
	t.Helper()
	for _, frame := range frames {
		if matches(frame) {
			return
		}
	}
	t.Fatal("expected ID3 frame was not preserved")
}

func TestFLACWriterPreservesUnownedComments(t *testing.T) {
	path := filepath.Join(t.TempDir(), "preserve.flac")
	if err := os.WriteFile(path, testutil.ReadFixture(t, "media", "flac", "audio-blank.flac"), 0o644); err != nil {
		t.Fatal(err)
	}
	file, err := flacfile.ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	for index, block := range file.Meta {
		if block.Type != flacfile.VorbisComment {
			continue
		}
		comments, parseErr := flacvorbis.ParseFromMetaDataBlock(*block)
		if parseErr != nil {
			t.Fatal(parseErr)
		}
		if addErr := comments.Add("PRESERVE_ME", "kept"); addErr != nil {
			t.Fatal(addErr)
		}
		updated := comments.Marshal()
		file.Meta[index] = &updated
	}
	if err := os.WriteFile(path, file.Marshal(), 0o644); err != nil {
		t.Fatal(err)
	}
	metadata := domain.Metadata{
		Title: "Title", Artists: []string{"Artist"}, Album: "Album", DiscNumber: "1", TrackNumber: "1",
	}
	if err := (flactag.Writer{}).Write(context.Background(), path, metadata, domain.DefaultMetadataConfig()); err != nil {
		t.Fatal(err)
	}
	file, err = flacfile.ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, block := range file.Meta {
		if block.Type != flacfile.VorbisComment {
			continue
		}
		comments, parseErr := flacvorbis.ParseFromMetaDataBlock(*block)
		if parseErr != nil {
			t.Fatal(parseErr)
		}
		values, getErr := comments.Get("PRESERVE_ME")
		if getErr == nil && reflect.DeepEqual(values, []string{"kept"}) {
			return
		}
	}
	t.Fatal("unowned FLAC comment was not preserved")
}
