//go:build server

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/the1812/Touhou-Tagger/go/gui/internal/bridge"
	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/bootstrap"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
	"github.com/the1812/Touhou-Tagger/go/internal/source/localjson"
	"github.com/the1812/Touhou-Tagger/go/internal/source/thbwiki"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

const (
	fixturesRootEnvironment     = "THTAG_GUI_FIXTURES_ROOT"
	fixtureDirectoryEnvironment = "THTAG_GUI_FIXTURE_DIR"
	fixtureCoverPath            = "/__fixture__/cover.jpg"
)

type fixtureAlbum struct {
	key  string
	name string
	page string
}

type fixtureWiki struct {
	albums  []fixtureAlbum
	byName  map[string]fixtureAlbum
	cover   []byte
	baseURL string
}

type loopbackTransport struct {
	host      string
	transport http.RoundTripper
}

func runtimeOptions(
	coverProcessor tagio.CoverProcessor,
) (bridge.ServiceFactory, []bridge.SourceOption, error) {
	root := strings.TrimSpace(os.Getenv(fixturesRootEnvironment))
	if root == "" {
		return nil, nil, fmt.Errorf("%s is required for a server build", fixturesRootEnvironment)
	}
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve fixture root %q: %w", root, err)
	}
	fixtures, err := loadFixtureWiki(absoluteRoot)
	if err != nil {
		return nil, nil, err
	}
	server := httptest.NewServer(fixtures)
	fixtures.baseURL = server.URL
	serverURL, err := url.Parse(server.URL)
	if err != nil {
		server.Close()
		return nil, nil, fmt.Errorf("parse fixture server URL: %w", err)
	}
	client := server.Client()
	client.Transport = loopbackTransport{
		host:      serverURL.Host,
		transport: client.Transport,
	}

	factory := func(
		config domain.MetadataConfig,
		events coreapp.EventSink,
	) (*coreapp.Service, error) {
		wiki, err := thbwiki.New(client, server.URL, config)
		if err != nil {
			return nil, err
		}
		return bootstrap.NewService(bootstrap.Options{
			Config:         config,
			Events:         events,
			CoverProcessor: coverProcessor,
			Sources: source.Registry{
				"thb-wiki":   wiki,
				"local-json": localjson.Source{},
			},
		})
	}
	return factory, []bridge.SourceOption{
		{Value: "thb-wiki", Label: "THBWiki", SupportsSearch: true},
		{Value: "local-json", Label: "本地 metadata.json", SupportsSearch: false},
	}, nil
}

func startupDirectory() string {
	directory := strings.TrimSpace(os.Getenv(fixtureDirectoryEnvironment))
	if directory == "" {
		return ""
	}
	absolute, err := filepath.Abs(directory)
	if err != nil {
		return directory
	}
	return absolute
}

func loadFixtureWiki(root string) (*fixtureWiki, error) {
	albumsDirectory := filepath.Join(root, "thb-wiki", "albums")
	entries, err := os.ReadDir(albumsDirectory)
	if err != nil {
		return nil, fmt.Errorf("read THBWiki album fixtures %q: %w", albumsDirectory, err)
	}
	fixtures := &fixtureWiki{
		byName: make(map[string]fixtureAlbum),
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		directory := filepath.Join(albumsDirectory, entry.Name())
		expectedData, err := os.ReadFile(filepath.Join(directory, "expected.json"))
		if err != nil {
			return nil, fmt.Errorf("read fixture contract for %q: %w", entry.Name(), err)
		}
		var contract struct {
			Album struct {
				Name string `json:"album"`
			} `json:"album"`
		}
		if err := json.Unmarshal(expectedData, &contract); err != nil {
			return nil, fmt.Errorf("parse fixture contract for %q: %w", entry.Name(), err)
		}
		if contract.Album.Name == "" {
			return nil, fmt.Errorf("fixture contract for %q has no album name", entry.Name())
		}
		page, err := os.ReadFile(filepath.Join(directory, "page.html"))
		if err != nil {
			return nil, fmt.Errorf("read fixture page for %q: %w", entry.Name(), err)
		}
		album := fixtureAlbum{
			key:  entry.Name(),
			name: contract.Album.Name,
			page: string(page),
		}
		fixtures.albums = append(fixtures.albums, album)
		fixtures.byName[album.name] = album
	}
	if len(fixtures.albums) == 0 {
		return nil, fmt.Errorf("no THBWiki album fixtures found in %q", albumsDirectory)
	}
	sort.Slice(fixtures.albums, func(left, right int) bool {
		return fixtures.albums[left].key < fixtures.albums[right].key
	})
	fixtures.cover, err = os.ReadFile(filepath.Join(root, "media", "images", "cover.jpg"))
	if err != nil {
		return nil, fmt.Errorf("read fixture cover: %w", err)
	}
	return fixtures, nil
}

func (fixtures *fixtureWiki) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	switch request.URL.Path {
	case "/api.php":
		fixtures.search(response, request)
	case fixtureCoverPath:
		response.Header().Set("Content-Type", "image/jpeg")
		_, _ = response.Write(fixtures.cover)
	default:
		fixtures.album(response, request)
	}
}

func (fixtures *fixtureWiki) search(response http.ResponseWriter, request *http.Request) {
	if request.URL.Query().Get("action") != "opensearch" {
		http.Error(response, "fixture server only supports opensearch", http.StatusBadRequest)
		return
	}
	query := request.URL.Query().Get("search")
	normalized := strings.ToLower(strings.TrimSpace(query))
	names := make([]string, 0, len(fixtures.albums))
	for _, album := range fixtures.albums {
		if normalized == "" ||
			strings.Contains(strings.ToLower(album.name), normalized) ||
			strings.Contains(strings.ToLower(album.key), normalized) {
			names = append(names, album.name)
		}
	}
	response.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(response).Encode([]any{query, names}); err != nil {
		http.Error(response, err.Error(), http.StatusInternalServerError)
	}
}

func (fixtures *fixtureWiki) album(response http.ResponseWriter, request *http.Request) {
	name, err := url.PathUnescape(strings.TrimPrefix(request.URL.EscapedPath(), "/"))
	if err != nil {
		http.Error(response, "invalid fixture album path", http.StatusBadRequest)
		return
	}
	album, exists := fixtures.byName[name]
	if !exists {
		http.NotFound(response, request)
		return
	}
	page, err := fixtures.withFixtureCover(album.page)
	if err != nil {
		http.Error(response, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = response.Write([]byte(page))
}

func (fixtures *fixtureWiki) withFixtureCover(page string) (string, error) {
	document, err := goquery.NewDocumentFromReader(strings.NewReader(page))
	if err != nil {
		return "", fmt.Errorf("parse fixture HTML: %w", err)
	}
	image := document.Find(".cover-artwork img").First()
	if image.Length() > 0 {
		image.SetAttr("src", fixtures.baseURL+"/thumb/__fixture__/cover.jpg/preview.jpg")
		image.RemoveAttr("srcset")
	}
	rendered, err := document.Html()
	if err != nil {
		return "", fmt.Errorf("render fixture HTML: %w", err)
	}
	return rendered, nil
}

func (transport loopbackTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.URL.Scheme != "http" || request.URL.Host != transport.host {
		return nil, fmt.Errorf("offline fixture blocked network request to %s", request.URL.Redacted())
	}
	return transport.transport.RoundTrip(request)
}
