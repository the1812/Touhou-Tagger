package thbwiki

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

func TestSearchFiltersLyricEntries(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api.php" {
			t.Errorf("unexpected endpoint: %s", request.URL.Path)
		}
		var body string
		switch request.URL.Query().Get("action") {
		case "opensearch":
			body = `["Album",["歌词:Album","Album","Another"]]`
		case "ask":
			if request.URL.Query().Get("query") != "[[Album]] OR [[Another]]|?制作方|?封面图片|limit=2" {
				t.Errorf("unexpected semantic query: %s", request.URL.RawQuery)
			}
			body = `{"query":{"results":{"Album":{"printouts":{"制作方":[{"fulltext":"Circle A"},{"fulltext":"Circle B"}],"封面图片":[{"fulltext":"File:Album_cover.jpg"}]}},"Another":{"printouts":{}}}}}`
		case "query":
			if request.URL.Query().Get("iiurlwidth") != "500" || request.URL.Query().Get("iiurlheight") != "500" {
				t.Errorf("unexpected thumbnail size: %s", request.URL.RawQuery)
			}
			body = `{"query":{"normalized":[{"from":"File:Album_cover.jpg","to":"文件:Album cover.jpg"}],"pages":[{"title":"文件:Album cover.jpg","imageinfo":[{"url":"https://example.test/original.jpg","thumburl":"https://example.test/500px-cover.jpg"}]}]}}`
		default:
			http.Error(response, "unexpected query", http.StatusBadRequest)
			return
		}
		if _, err := response.Write([]byte(body)); err != nil {
			t.Error(err)
		}
	}))
	defer server.Close()
	wiki, err := New(server.Client(), server.URL, testMetadataConfig(nil))
	if err != nil {
		t.Fatal(err)
	}
	candidates, err := wiki.Search(context.Background(), "Album")
	if err != nil {
		t.Fatal(err)
	}
	if len(candidates) != 2 || candidates[0].Name != "Album" || candidates[1].Name != "Another" {
		t.Fatalf("unexpected candidates: %#v", candidates)
	}
	if strings.Join(candidates[0].Artists, " / ") != "Circle A / Circle B" || candidates[0].ThumbnailURL != "https://example.test/500px-cover.jpg" || candidates[1].ThumbnailURL != "" {
		t.Fatalf("unexpected search details: %#v", candidates)
	}
}

func TestFindLyricURLFiltersUnsupportedLinks(t *testing.T) {
	testCases := []struct {
		name      string
		link      string
		wantFound bool
	}{
		{name: "internal", link: `<a href="/歌词:Available">歌词</a>`, wantFound: true},
		{name: "red link", link: `<a class="new" href="/index.php?title=歌词:Missing&amp;action=edit&amp;redlink=1">歌词</a>`},
		{name: "external", link: `<a class="external" href="https://example.com/歌词:External">歌词</a>`},
		{name: "no link", link: `<span>无歌词</span>`},
	}
	wiki, err := New(http.DefaultClient, "https://fixture.invalid", testMetadataConfig(nil))
	if err != nil {
		t.Fatal(err)
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			document, err := goquery.NewDocumentFromReader(strings.NewReader("<div>" + testCase.link + "</div>"))
			if err != nil {
				t.Fatal(err)
			}
			actual := wiki.findLyricURL(document.Find("div").First())
			if (actual != "") != testCase.wantFound {
				t.Fatalf("findLyricURL() = %q, want found %t", actual, testCase.wantFound)
			}
		})
	}
}

func TestNormalizeNamesDeduplicatesAliases(t *testing.T) {
	actual := normalizeNames([]string{"suslik", "DJ suslik", "Artist\u200b\u3000(Name)"}, true)
	want := []string{"cnsuslik", "Artist (Name)"}
	if len(actual) != len(want) {
		t.Fatalf("normalizeNames() = %#v, want %#v", actual, want)
	}
	for index := range want {
		if actual[index] != want[index] {
			t.Fatalf("normalizeNames() = %#v, want %#v", actual, want)
		}
	}
}
