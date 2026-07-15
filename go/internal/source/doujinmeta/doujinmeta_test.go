package doujinmeta

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSearchAndFetch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		var body string
		switch request.URL.Path {
		case "/api/albums/search/Test Album":
			body = `[{"id":"1","name":"Test Album","coverUrl":"","detailUrl":"","matches":[]}]`
		case "/api/albums/detail/Test Album":
			body = fmt.Sprintf(`{"name":"Test Album","coverUrl":%q,"metadata":[{"title":"Track","artists":["Artist"],"album":"Test Album"}]}`, serverURL(request)+"/cover")
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
	if len(candidates) != 1 || candidates[0].ID != "Test Album" {
		t.Fatalf("unexpected candidates: %#v", candidates)
	}
	metadata, err := source.Fetch(context.Background(), candidates[0].ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(metadata) != 1 || metadata[0].TrackNumber != "1" || metadata[0].DiscNumber != "1" {
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

func serverURL(request *http.Request) string {
	return "http://" + request.Host
}
