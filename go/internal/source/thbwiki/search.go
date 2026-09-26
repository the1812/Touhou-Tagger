package thbwiki

import (
	"context"
	"fmt"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type searchAPIError struct {
	Code string `json:"code"`
	Info string `json:"info"`
}

func (wiki *Source) loadSearchDetails(ctx context.Context, candidates []domain.AlbumCandidate) error {
	conditions := make([]string, len(candidates))
	for index, candidate := range candidates {
		conditions[index] = "[[" + candidate.ID + "]]"
	}
	var details struct {
		Query struct {
			Results map[string]struct {
				Printouts map[string][]struct {
					Fulltext string `json:"fulltext"`
				} `json:"printouts"`
			} `json:"results"`
		} `json:"query"`
		Error *searchAPIError `json:"error"`
	}
	if _, err := wiki.client.R().SetContext(ctx).SetQueryParams(map[string]string{
		"action": "ask", "format": "json",
		"query": strings.Join(conditions, " OR ") + "|?制作方|?封面图片|limit=" + fmt.Sprint(len(candidates)),
	}).SetResult(&details).ForceContentType("application/json").Get(wiki.apiEndpoint().String()); err != nil {
		return fmt.Errorf("query THBWiki search details: %w", err)
	}
	if details.Error != nil {
		return fmt.Errorf("THBWiki search details error %s: %s", details.Error.Code, details.Error.Info)
	}
	files := make(map[string]string)
	var titles []string
	for index := range candidates {
		candidate := &candidates[index]
		printouts := details.Query.Results[candidate.ID].Printouts
		for _, artist := range printouts["制作方"] {
			name := artist.Fulltext
			if replacement, exists := albumArtistAlternateNames[name]; exists {
				name = replacement
			}
			candidate.Artists = append(candidate.Artists, name)
		}
		if covers := printouts["封面图片"]; len(covers) > 0 {
			files[candidate.ID] = covers[0].Fulltext
			titles = append(titles, covers[0].Fulltext)
		}
	}
	if len(titles) == 0 {
		return nil
	}
	var images struct {
		Query struct {
			Normalized []struct {
				From string `json:"from"`
				To   string `json:"to"`
			} `json:"normalized"`
			Pages []struct {
				Title     string `json:"title"`
				ImageInfo []struct {
					URL      string `json:"url"`
					ThumbURL string `json:"thumburl"`
				} `json:"imageinfo"`
			} `json:"pages"`
		} `json:"query"`
		Error *searchAPIError `json:"error"`
	}
	if _, err := wiki.client.R().SetContext(ctx).SetQueryParams(map[string]string{
		"action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
		"titles": strings.Join(titles, "|"), "iiprop": "url", "iiurlwidth": "500", "iiurlheight": "500",
	}).SetResult(&images).ForceContentType("application/json").Get(wiki.apiEndpoint().String()); err != nil {
		return fmt.Errorf("query THBWiki search covers: %w", err)
	}
	if images.Error != nil {
		return fmt.Errorf("THBWiki search covers error %s: %s", images.Error.Code, images.Error.Info)
	}
	urls := make(map[string]string)
	for _, page := range images.Query.Pages {
		if len(page.ImageInfo) > 0 {
			info := page.ImageInfo[0]
			urls[page.Title] = info.ThumbURL
			if info.ThumbURL == "" {
				urls[page.Title] = info.URL
			}
		}
	}
	for _, normalized := range images.Query.Normalized {
		urls[normalized.From] = urls[normalized.To]
	}
	for index := range candidates {
		candidates[index].ThumbnailURL = urls[files[candidates[index].ID]]
	}
	return nil
}
