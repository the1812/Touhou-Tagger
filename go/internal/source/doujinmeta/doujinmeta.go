package doujinmeta

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/go-resty/resty/v2"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

type Source struct {
	client  *resty.Client
	baseURL *url.URL
}

type searchItem struct {
	ID    string `json:"id"`
	Album string `json:"album"`
}

type searchResult struct {
	Items []searchItem `json:"items"`
}

type albumDetail struct {
	Album        string         `json:"album"`
	AlbumOrder   string         `json:"albumOrder"`
	AlbumArtists []string       `json:"albumArtists"`
	Genres       []string       `json:"genres"`
	Year         string         `json:"year"`
	ExtraData    map[string]any `json:"extraData"`
	Links        struct {
		Cover string `json:"cover"`
	} `json:"links"`
	Tracks []domain.Metadata `json:"tracks"`
}

func New(client *http.Client, base string) (*Source, error) {
	parsed, err := url.Parse(base)
	if err != nil {
		return nil, fmt.Errorf("parse Doujin Meta base URL: %w", err)
	}
	return &Source{client: source.NewHTTPClient(client), baseURL: parsed}, nil
}

func (sourceClient *Source) Search(
	ctx context.Context,
	query string,
) ([]domain.AlbumCandidate, error) {
	endpoint := sourceClient.baseURL.ResolveReference(&url.URL{
		Path:     "/api/albums",
		RawQuery: url.Values{"keyword": []string{query}, "limit": []string{strconv.Itoa(source.MaxSearchCount)}}.Encode(),
	}).String()
	var result searchResult
	if _, err := sourceClient.client.R().SetContext(ctx).SetResult(&result).
		ForceContentType("application/json").Get(endpoint); err != nil {
		return nil, fmt.Errorf("search Doujin Meta: %w", err)
	}
	if len(result.Items) > source.MaxSearchCount {
		result.Items = result.Items[:source.MaxSearchCount]
	}
	candidates := make([]domain.AlbumCandidate, len(result.Items))
	for index, item := range result.Items {
		candidates[index] = domain.AlbumCandidate{
			ID:     item.ID,
			Name:   item.Album,
			Source: "doujin-meta",
		}
	}
	return candidates, nil
}

func (sourceClient *Source) Fetch(
	ctx context.Context,
	id string,
	cover []byte,
) ([]domain.Metadata, error) {
	endpoint := sourceClient.resolveResource("/api/albums/", id)
	var detail albumDetail
	if _, err := sourceClient.client.R().SetContext(ctx).SetResult(&detail).
		ForceContentType("application/json").Get(endpoint); err != nil {
		return nil, fmt.Errorf("fetch Doujin Meta album %q: %w", id, err)
	}
	if len(detail.Tracks) > 0 {
		detail.Tracks[0].Album = detail.Album
		detail.Tracks[0].AlbumOrder = detail.AlbumOrder
		detail.Tracks[0].AlbumArtists = detail.AlbumArtists
		if detail.Tracks[0].Genres == nil {
			detail.Tracks[0].Genres = detail.Genres
		}
		detail.Tracks[0].Year = detail.Year
		detail.Tracks[0].ExtraData = detail.ExtraData
	}
	if len(cover) == 0 && detail.Links.Cover != "" {
		coverURL, err := sourceClient.baseURL.Parse(detail.Links.Cover)
		if err != nil {
			return nil, fmt.Errorf("resolve Doujin Meta cover URL: %w", err)
		}
		response, err := sourceClient.client.R().SetContext(ctx).Get(coverURL.String())
		if err != nil {
			return nil, fmt.Errorf("fetch Doujin Meta cover: %w", err)
		}
		cover = response.Body()
	}
	return domain.ExpandMetadata(detail.Tracks, cover), nil
}

func (sourceClient *Source) resolveResource(prefix, value string) string {
	return sourceClient.baseURL.ResolveReference(&url.URL{
		Path:    prefix + value,
		RawPath: prefix + url.PathEscape(value),
	}).String()
}
