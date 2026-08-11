package doujinmeta

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

type Source struct {
	client  *http.Client
	baseURL *url.URL
}

type searchItem struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	CoverURL  string       `json:"coverUrl"`
	DetailURL string       `json:"detailUrl"`
	Matches   [][2]float64 `json:"matches"`
}

type albumDetail struct {
	Name        string            `json:"name"`
	CoverURL    string            `json:"coverUrl"`
	Metadata    []domain.Metadata `json:"metadata"`
	MetadataURL string            `json:"metadataUrl"`
	RawURL      string            `json:"rawUrl"`
}

func New(client *http.Client, base string) (*Source, error) {
	parsed, err := url.Parse(base)
	if err != nil {
		return nil, fmt.Errorf("parse Doujin Meta base URL: %w", err)
	}
	return &Source{client: client, baseURL: parsed}, nil
}

func (sourceClient *Source) Search(
	ctx context.Context,
	query string,
) ([]domain.AlbumCandidate, error) {
	endpoint := sourceClient.resolveResource("/api/albums/search/", query)
	var result []searchItem
	if err := sourceClient.getJSON(ctx, endpoint, &result); err != nil {
		return nil, fmt.Errorf("search Doujin Meta: %w", err)
	}
	if len(result) > source.MaxSearchCount {
		result = result[:source.MaxSearchCount]
	}
	candidates := make([]domain.AlbumCandidate, len(result))
	for index, item := range result {
		candidates[index] = domain.AlbumCandidate{
			ID:     item.Name,
			Name:   item.Name,
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
	endpoint := sourceClient.resolveResource("/api/albums/detail/", id)
	var detail albumDetail
	if err := sourceClient.getJSON(ctx, endpoint, &detail); err != nil {
		return nil, fmt.Errorf("fetch Doujin Meta album %q: %w", id, err)
	}
	if len(cover) == 0 && detail.CoverURL != "" {
		coverURL, err := sourceClient.baseURL.Parse(detail.CoverURL)
		if err != nil {
			return domain.ExpandMetadata(detail.Metadata, nil), &source.PartialFetchError{
				Err: fmt.Errorf("resolve Doujin Meta cover URL: %w", err),
			}
		}
		cover, err = sourceClient.getBytes(ctx, coverURL.String())
		if err != nil {
			return domain.ExpandMetadata(detail.Metadata, nil), &source.PartialFetchError{
				Err: fmt.Errorf("fetch Doujin Meta cover: %w", err),
			}
		}
	}
	return domain.ExpandMetadata(detail.Metadata, cover), nil
}

func (sourceClient *Source) resolveResource(prefix, value string) string {
	return sourceClient.baseURL.ResolveReference(&url.URL{
		Path:    prefix + value,
		RawPath: prefix + url.PathEscape(value),
	}).String()
}

func (sourceClient *Source) getJSON(ctx context.Context, endpoint string, output any) error {
	data, err := sourceClient.getBytes(ctx, endpoint)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, output); err != nil {
		return fmt.Errorf("decode %s: %w", endpoint, err)
	}
	return nil
}

func (sourceClient *Source) getBytes(ctx context.Context, endpoint string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	response, err := sourceClient.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request %s: %w", endpoint, err)
	}
	data, err := io.ReadAll(response.Body)
	closeErr := response.Body.Close()
	if err != nil || closeErr != nil {
		return nil, fmt.Errorf("read response from %s: %w", endpoint, errors.Join(err, closeErr))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("request %s returned %s: %s", endpoint, response.Status, strings.TrimSpace(string(data)))
	}
	return data, nil
}
