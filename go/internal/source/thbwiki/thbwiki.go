package thbwiki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

type Source struct {
	client *http.Client
	base   *url.URL
	config domain.MetadataConfig
	lyrics *lyricsService
}

func New(client *http.Client, base string, config domain.MetadataConfig) (*Source, error) {
	parsed, err := url.Parse(base)
	if err != nil {
		return nil, fmt.Errorf("parse THBWiki base URL: %w", err)
	}
	instance := &Source{client: client, base: parsed, config: config}
	instance.lyrics = newLyricsService(instance)
	return instance, nil
}

func (wiki *Source) Search(
	ctx context.Context,
	query string,
) ([]domain.AlbumCandidate, error) {
	endpoint := wiki.base.ResolveReference(&url.URL{Path: "/api.php"})
	parameters := endpoint.Query()
	parameters.Set("action", "opensearch")
	parameters.Set("format", "json")
	parameters.Set("formatversion", "2")
	parameters.Set("search", query)
	parameters.Set("limit", fmt.Sprint(source.MaxSearchCount))
	parameters.Set("suggest", "true")
	endpoint.RawQuery = parameters.Encode()
	data, err := wiki.get(ctx, endpoint.String())
	if err != nil {
		return nil, fmt.Errorf("search THBWiki: %w", err)
	}
	var response []json.RawMessage
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, fmt.Errorf("decode THBWiki search response: %w", err)
	}
	if len(response) < 2 {
		return []domain.AlbumCandidate{}, nil
	}
	var names []string
	if err := json.Unmarshal(response[1], &names); err != nil {
		return nil, fmt.Errorf("decode THBWiki search names: %w", err)
	}
	candidates := make([]domain.AlbumCandidate, 0, len(names))
	for _, name := range names {
		if strings.HasPrefix(name, "歌词:") {
			continue
		}
		candidates = append(candidates, domain.AlbumCandidate{
			ID: name, Name: name, Source: "thb-wiki",
		})
	}
	return candidates, nil
}

func (wiki *Source) Fetch(
	ctx context.Context,
	id string,
	cover []byte,
) ([]domain.Metadata, error) {
	endpoint := wiki.base.ResolveReference(&url.URL{
		Path:    "/" + id,
		RawPath: "/" + url.PathEscape(id),
	})
	data, err := wiki.get(ctx, endpoint.String())
	if err != nil {
		return nil, fmt.Errorf("fetch THBWiki album %q: %w", id, err)
	}
	return wiki.ParseAlbumHTML(ctx, string(data), cover)
}

func (wiki *Source) ParseAlbumHTML(
	ctx context.Context,
	htmlContent string,
	cover []byte,
) ([]domain.Metadata, error) {
	document, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("parse THBWiki album HTML: %w", err)
	}
	infoTable := document.Find(".doujininfo").First()
	if infoTable.Length() == 0 {
		return nil, fmt.Errorf("THBWiki page is not a doujin album entry")
	}
	album := tableValue(infoTable, "名称")
	albumOrder := tableValue(infoTable, "编号")
	albumArtists := tableLinks(infoTable, "制作方")
	for index, artist := range albumArtists {
		if replacement, exists := albumArtistAlternateNames[artist]; exists {
			albumArtists[index] = replacement
		}
	}
	genreValue := tableValue(infoTable, "风格类型")
	genres := []string{}
	if genreValue != "" {
		genres = splitValues(genreValue)
	}
	year := leadingDigits(tableValue(infoTable, "首发日期"))
	if len(cover) == 0 {
		image := document.Find(".cover-artwork img").First()
		if image.Length() > 0 {
			sourceURL, exists := image.Attr("src")
			if exists && sourceURL != "" {
				cover, err = wiki.downloadCover(ctx, sourceURL)
				if err != nil {
					return nil, err
				}
			}
		}
	}
	metadata := make([]domain.Metadata, 0)
	var parseErr error
	discNumber := 0
	document.Find(".musicTable").EachWithBreak(func(_ int, table *goquery.Selection) bool {
		discNumber++
		table.Find("tr").EachWithBreak(func(_ int, row *goquery.Selection) bool {
			if findTrackNumberCell(row).Length() == 0 {
				return true
			}
			item, err := wiki.parseTrack(ctx, row)
			if err != nil {
				parseErr = err
				return false
			}
			item.DiscNumber = fmt.Sprint(discNumber)
			item.Album = album
			item.AlbumOrder = albumOrder
			item.AlbumArtists = append([]string(nil), albumArtists...)
			item.Genres = append([]string{}, genres...)
			item.Year = year
			item.CoverImage = cover
			metadata = append(metadata, item)
			return true
		})
		return parseErr == nil
	})
	if parseErr != nil {
		return nil, parseErr
	}
	return metadata, nil
}

func (wiki *Source) downloadCover(ctx context.Context, sourceURL string) ([]byte, error) {
	parsed, err := wiki.base.Parse(sourceURL)
	if err != nil {
		return nil, fmt.Errorf("resolve THBWiki cover URL: %w", err)
	}
	parsed.Path = strings.Replace(parsed.Path, "/thumb/", "/", 1)
	parsed.Path = path.Dir(parsed.Path)
	data, err := wiki.get(ctx, parsed.String())
	if err != nil {
		return nil, fmt.Errorf("download THBWiki cover: %w", err)
	}
	return data, nil
}

func (wiki *Source) get(ctx context.Context, endpoint string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	response, err := wiki.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request %s: %w", endpoint, err)
	}
	data, readErr := io.ReadAll(response.Body)
	closeErr := response.Body.Close()
	if readErr != nil || closeErr != nil {
		return nil, fmt.Errorf("read response from %s: %w", endpoint, errors.Join(readErr, closeErr))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("request %s returned %s: %s", endpoint, response.Status, strings.TrimSpace(string(data)))
	}
	return data, nil
}

func tableValue(table *goquery.Selection, label string) string {
	value := ""
	table.Find(".label").EachWithBreak(func(_ int, selection *goquery.Selection) bool {
		if strings.TrimSpace(selection.Text()) != label {
			return true
		}
		value = strings.TrimSpace(selection.Next().Text())
		return false
	})
	return value
}

func tableLinks(table *goquery.Selection, label string) []string {
	var values []string
	table.Find(".label").EachWithBreak(func(_ int, selection *goquery.Selection) bool {
		if strings.TrimSpace(selection.Text()) != label {
			return true
		}
		selection.Next().Find("a").Each(func(_ int, link *goquery.Selection) {
			value := strings.TrimSpace(link.Text())
			if value != "" {
				values = append(values, value)
			}
		})
		return false
	})
	return values
}

func leadingDigits(value string) string {
	end := 0
	for end < len(value) && value[end] >= '0' && value[end] <= '9' {
		end++
	}
	return value[:end]
}
