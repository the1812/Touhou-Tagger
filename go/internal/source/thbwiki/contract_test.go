package thbwiki

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/testutil"
)

type albumContract struct {
	Cover  bool              `json:"cover"`
	Album  domain.Metadata   `json:"album"`
	Tracks []domain.Metadata `json:"tracks"`
}

type lyricContract struct {
	Name                 string           `json:"name"`
	Title                string           `json:"title"`
	Type                 domain.LyricType `json:"type"`
	Time                 bool             `json:"time"`
	TranslationSeparator string           `json:"translationSeparator"`
	Language             *string          `json:"language"`
	Expected             string           `json:"expected"`
}

func TestAlbumContracts(t *testing.T) {
	cases := []string{
		"single-disc", "multiple-disc", "has-composer", "no-cover",
		"multiline-artists", "multiple-instruments", "remix-compilation",
	}
	for _, name := range cases {
		t.Run(name, func(t *testing.T) {
			base := []string{"thb-wiki", "albums", name}
			page := string(testutil.ReadFixture(t, append(base, "page.html")...))
			var contract albumContract
			if err := json.Unmarshal(testutil.ReadFixture(t, append(base, "expected.json")...), &contract); err != nil {
				t.Fatalf("parse album contract: %v", err)
			}
			wiki, err := New(http.DefaultClient, "https://fixture.invalid", testMetadataConfig(nil))
			if err != nil {
				t.Fatal(err)
			}
			var cover []byte
			if contract.Cover {
				cover = []byte("fixture cover")
			}
			actual, err := wiki.ParseAlbumHTML(context.Background(), page, cover)
			if err != nil {
				t.Fatal(err)
			}
			if len(actual) != len(contract.Tracks) {
				t.Fatalf("track count: got %d, want %d", len(actual), len(contract.Tracks))
			}
			for index, expected := range contract.Tracks {
				expected.Album = contract.Album.Album
				expected.AlbumOrder = contract.Album.AlbumOrder
				expected.AlbumArtists = contract.Album.AlbumArtists
				expected.Genres = contract.Album.Genres
				expected.Year = contract.Album.Year
				expected.CoverImage = cover
				if !reflect.DeepEqual(actual[index], expected) {
					t.Errorf("track %d mismatch\ngot:  %#v\nwant: %#v", index+1, actual[index], expected)
				}
			}
		})
	}
}

func TestLyricContracts(t *testing.T) {
	for _, name := range []string{"single-lang", "multiple-lang"} {
		t.Run(name, func(t *testing.T) {
			base := []string{"thb-wiki", "lyrics", name}
			page := testutil.ReadFixture(t, append(base, "page.html")...)
			var contracts []lyricContract
			if err := json.Unmarshal(testutil.ReadFixture(t, append(base, "cases.json")...), &contracts); err != nil {
				t.Fatalf("parse lyric contracts: %v", err)
			}
			for _, contract := range contracts {
				t.Run(contract.Name, func(t *testing.T) {
					server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
						if _, err := response.Write(page); err != nil {
							t.Error(err)
						}
					}))
					defer server.Close()
					lyric := &domain.LyricConfig{
						Type: contract.Type, Output: domain.LyricMetadata, Time: contract.Time,
						TranslationSeparator: contract.TranslationSeparator, MaxCacheSize: 10,
					}
					wiki, err := New(server.Client(), server.URL, testMetadataConfig(lyric))
					if err != nil {
						t.Fatal(err)
					}
					actual, language, err := wiki.lyrics.Download(context.Background(), server.URL+"/page", contract.Title)
					if err != nil {
						t.Fatal(err)
					}
					expected := strings.TrimSuffix(string(testutil.ReadFixture(t, append(base, filepath.FromSlash(contract.Expected))...)), "\n")
					expected = strings.TrimSuffix(expected, "\r")
					if actual != expected {
						t.Errorf("lyrics mismatch\ngot:\n%s\nwant:\n%s", actual, expected)
					}
					expectedLanguage := ""
					if contract.Language != nil {
						expectedLanguage = *contract.Language
					}
					if language != expectedLanguage {
						t.Errorf("language: got %q, want %q", language, expectedLanguage)
					}
				})
			}
		})
	}
}

func TestLRCContracts(t *testing.T) {
	cases := []struct {
		name       string
		trackTitle string
		pathSuffix string
		language   string
	}{
		{name: "single-lang", trackTitle: "irrelevant track title", pathSuffix: "..lrc", language: "zh"},
		{name: "multiple-lang", trackTitle: "Bad Apple!! Graph Tech Remix", pathSuffix: ".3..lrc", language: "ja"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			base := []string{"thb-wiki", "lyrics", testCase.name}
			page := testutil.ReadFixture(t, append(base, "page.html")...)
			expected := strings.TrimRight(string(testutil.ReadFixture(t, append(base, "expected", "lrc.txt")...)), "\r\n")
			var requestedPath string
			var mutex sync.Mutex
			server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
				if request.URL.Path == "/page" {
					if _, err := response.Write(page); err != nil {
						t.Error(err)
					}
					return
				}
				mutex.Lock()
				requestedPath = request.URL.Path
				mutex.Unlock()
				if _, err := response.Write([]byte(expected)); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			lyric := domain.DefaultLyricConfig()
			lyric.Output = domain.LyricLRC
			wiki, err := New(server.Client(), server.URL, testMetadataConfig(&lyric))
			if err != nil {
				t.Fatal(err)
			}
			actual, language, err := wiki.lyrics.Download(context.Background(), server.URL+"/page", testCase.trackTitle)
			if err != nil {
				t.Fatal(err)
			}
			if actual != expected || language != testCase.language {
				t.Fatalf("got lyric=%q language=%q, want lyric=%q language=%q", actual, language, expected, testCase.language)
			}
			mutex.Lock()
			path := requestedPath
			mutex.Unlock()
			if !strings.HasSuffix(path, testCase.pathSuffix) {
				t.Errorf("LRC path %q does not end with %q", path, testCase.pathSuffix)
			}
		})
	}
}

func testMetadataConfig(lyric *domain.LyricConfig) domain.MetadataConfig {
	return domain.MetadataConfig{
		Lyric: lyric, LyricEnabled: lyric != nil,
		CommentLanguage: "zho", Separator: domain.DefaultMetadataSeparator,
		Timeout: 5, Retry: 1,
	}
}
