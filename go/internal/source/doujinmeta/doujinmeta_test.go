package doujinmeta

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSearchAndFetch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		var body string
		switch request.URL.Path {
		case "/api/albums":
			if request.URL.Query().Get("keyword") != "Test Album" || request.URL.Query().Get("limit") != "20" {
				t.Fatalf("unexpected search query: %q", request.URL.RawQuery)
			}
			body = `{"items":[{"id":"01k3z4p8q9r0s1t2v3w4x5y6z7","album":"Test Album"}],"total":1,"limit":20,"offset":0}`
		case "/api/albums/01k3z4p8q9r0s1t2v3w4x5y6z7":
			body = `{"album":"Test Album","albumOrder":"TEST-001","albumArtists":["Circle"],"genres":["Trance"],"year":"2026","extraData":{"source":"test"},"links":{"cover":"/cover"},"tracks":[{"title":"Track","artists":["Artist"],"discNumber":"1","trackNumber":"1"}]}`
		case "/cover":
			body = "cover bytes"
		default:
			http.NotFound(response, request)
			return
		}
		if _, err := response.Write([]byte(body)); err != nil {
			t.Error(err)
		}
	}))
	defer server.Close()
	source, err := New(server.Client(), server.URL)
	if err != nil {
		t.Fatal(err)
	}
	candidates, err := source.Search(context.Background(), "Test Album")
	if err != nil {
		t.Fatal(err)
	}
	if len(candidates) != 1 || candidates[0].ID != "01k3z4p8q9r0s1t2v3w4x5y6z7" || candidates[0].Name != "Test Album" {
		t.Fatalf("unexpected candidates: %#v", candidates)
	}
	metadata, err := source.Fetch(context.Background(), candidates[0].ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(metadata) != 1 ||
		metadata[0].Album != "Test Album" ||
		metadata[0].AlbumOrder != "TEST-001" ||
		metadata[0].TrackNumber != "1" ||
		metadata[0].DiscNumber != "1" {
		t.Fatalf("unexpected expanded metadata: %#v", metadata)
	}
	if string(metadata[0].CoverImage) != "cover bytes" {
		t.Fatalf("unexpected cover: %q", metadata[0].CoverImage)
	}
}

func TestHTTPFailureIsExplicit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		http.Error(response, "broken", http.StatusBadGateway)
	}))
	defer server.Close()
	source, err := New(server.Client(), server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := source.Search(context.Background(), "album"); err == nil {
		t.Fatal("expected HTTP status error")
	}
}
