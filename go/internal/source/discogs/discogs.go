package discogs

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

var (
	requests      = source.NewRequestLimiter(3 * time.Second)
	artistSuffix  = regexp.MustCompile(` \(\d+\)$`)
	trackPosition = regexp.MustCompile(`(?i)^(?:(?:CD)?(\d+)[-.])?(\d+)$`)
	roleDetail    = regexp.MustCompile(`\[[^\]]*\]`)
	trackRange    = regexp.MustCompile(`(?i)\s+to\s+`)
)

type Source struct {
	client *resty.Client
	images *resty.Client
}

type artist struct {
	Name   string `json:"name"`
	ANV    string `json:"anv"`
	Role   string `json:"role"`
	Tracks string `json:"tracks"`
}

type track struct {
	Position     string   `json:"position"`
	Type         string   `json:"type_"`
	Title        string   `json:"title"`
	Artists      []artist `json:"artists"`
	ExtraArtists []artist `json:"extraartists"`
	SubTracks    []track  `json:"sub_tracks"`
}

type release struct {
	Title        string   `json:"title"`
	Year         int      `json:"year"`
	Artists      []artist `json:"artists"`
	ExtraArtists []artist `json:"extraartists"`
	Labels       []struct {
		Catno string `json:"catno"`
	} `json:"labels"`
	Genres    []string `json:"genres"`
	Styles    []string `json:"styles"`
	Tracklist []track  `json:"tracklist"`
	Images    []struct {
		Type string `json:"type"`
		URI  string `json:"uri"`
	} `json:"images"`
}

func New(client *http.Client) *Source {
	api := source.NewHTTPClient(client).SetBaseURL("https://api.discogs.com")
	api.OnBeforeRequest(func(_ *resty.Client, request *resty.Request) error {
		return requests.Wait(request.Context())
	})
	return &Source{client: api, images: source.NewHTTPClient(client)}
}

func (provider *Source) Search(ctx context.Context, query string) ([]domain.AlbumCandidate, error) {
	var result struct {
		Results []struct {
			ID         int      `json:"id"`
			Title      string   `json:"title"`
			Year       string   `json:"year"`
			Country    string   `json:"country"`
			Catno      string   `json:"catno"`
			Format     []string `json:"format"`
			CoverImage string   `json:"cover_image"`
		} `json:"results"`
	}
	if _, err := provider.client.R().SetContext(ctx).SetQueryParams(map[string]string{
		"q": query, "type": "release", "format": "CD", "per_page": strconv.Itoa(source.MaxSearchCount),
	}).SetResult(&result).Get("/database/search"); err != nil {
		return nil, fmt.Errorf("search Discogs: %w", err)
	}
	candidates := make([]domain.AlbumCandidate, 0, len(result.Results))
	for _, item := range result.Results {
		artist, title, found := strings.Cut(item.Title, " - ")
		if !found {
			title, artist = item.Title, ""
		}
		var artists []string
		if artist != "" {
			artists = []string{artistSuffix.ReplaceAllString(artist, "")}
		}
		id := strconv.Itoa(item.ID)
		parts := []string{artist, item.Year, item.Catno, item.Country, strings.Join(item.Format, " / "), id}
		parts = slices.DeleteFunc(parts, func(value string) bool { return value == "" })
		candidates = append(candidates, domain.AlbumCandidate{
			ID: id, Name: title, Source: "discogs", Artists: artists, Description: strings.Join(parts, " · "),
			ThumbnailURL: item.CoverImage,
		})
	}
	return candidates, nil
}

func (provider *Source) Fetch(ctx context.Context, id string, cover []byte) ([]domain.Metadata, error) {
	var album release
	if _, err := provider.client.R().SetContext(ctx).SetResult(&album).Get("/releases/" + url.PathEscape(id)); err != nil {
		return nil, fmt.Errorf("fetch Discogs release %q: %w", id, err)
	}
	var tracks []track
	var positions []string
	for _, item := range album.Tracklist {
		if item.Type != "heading" {
			tracks = append(tracks, item)
			positions = append(positions, item.Position)
		}
	}
	if len(tracks) == 0 {
		return nil, fmt.Errorf("discogs release %q has no audio tracks", id)
	}
	var catalogs []string
	for _, label := range album.Labels {
		if label.Catno != "" && !strings.EqualFold(label.Catno, "none") && !slices.Contains(catalogs, label.Catno) {
			catalogs = append(catalogs, label.Catno)
		}
	}
	genres := slices.Clone(album.Genres)
	for _, style := range album.Styles {
		if !slices.Contains(genres, style) {
			genres = append(genres, style)
		}
	}
	year := ""
	if album.Year != 0 {
		year = strconv.Itoa(album.Year)
	}
	metadata := make([]domain.Metadata, 0, len(tracks))
	seen := make(map[string]bool)
	for _, item := range tracks {
		position := trackPosition.FindStringSubmatch(item.Position)
		if position == nil || item.Type != "track" || len(item.SubTracks) > 0 {
			return nil, fmt.Errorf("discogs release %q has an unsupported track position or index: %q (%s)", id, item.Position, item.Title)
		}
		disc := strings.TrimLeft(position[1], "0")
		if disc == "" {
			disc = "1"
		}
		number := strings.TrimLeft(position[2], "0")
		if number == "" {
			number = "0"
		}
		key := disc + "-" + number
		if seen[key] {
			return nil, fmt.Errorf("discogs release %q has duplicate track positions", id)
		}
		seen[key] = true
		var credits []artist
		for _, credit := range album.ExtraArtists {
			if appliesToTrack(credit.Tracks, item.Position, positions) {
				credits = append(credits, credit)
			}
		}
		credits = append(credits, item.ExtraArtists...)
		artists := item.Artists
		if len(artists) == 0 {
			artists = album.Artists
		}
		metadata = append(metadata, domain.Metadata{
			Album: album.Title, AlbumOrder: strings.Join(catalogs, " / "), AlbumArtists: artistNames(album.Artists),
			Year: year, Title: item.Title, DiscNumber: disc, TrackNumber: number,
			Artists: artistNames(artists), Genres: slices.Clone(genres),
			Composers: creditNames(credits, []string{"composed by", "music by"}),
			Lyricists: creditNames(credits, []string{"lyrics by", "words by"}),
		})
	}
	if len(cover) == 0 && len(album.Images) > 0 {
		image := album.Images[0]
		for _, candidate := range album.Images {
			if candidate.Type == "primary" {
				image = candidate
				break
			}
		}
		if image.URI != "" {
			response, err := provider.images.R().SetContext(ctx).Get(image.URI)
			if err != nil {
				return nil, fmt.Errorf("fetch Discogs cover: %w", err)
			}
			cover = response.Body()
		}
	}
	return domain.ExpandMetadata(metadata, cover), nil
}

func artistNames(artists []artist) []string {
	names := make([]string, 0, len(artists))
	for _, item := range artists {
		name := item.ANV
		if name == "" {
			name = artistSuffix.ReplaceAllString(item.Name, "")
		}
		names = append(names, name)
	}
	return names
}

func creditNames(credits []artist, roles []string) []string {
	var artists []artist
	for _, credit := range credits {
		for _, role := range strings.Split(roleDetail.ReplaceAllString(credit.Role, ""), ",") {
			if slices.Contains(roles, strings.ToLower(strings.TrimSpace(role))) {
				artists = append(artists, credit)
				break
			}
		}
	}
	var names []string
	for _, name := range artistNames(artists) {
		if !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	return names
}

func appliesToTrack(scope, position string, positions []string) bool {
	if strings.TrimSpace(scope) == "" {
		return true
	}
	for _, part := range strings.Split(scope, ",") {
		bounds := trackRange.Split(strings.TrimSpace(part), -1)
		if len(bounds) == 1 {
			if bounds[0] == position {
				return true
			}
			continue
		}
		start, end, index := slices.Index(positions, bounds[0]), slices.Index(positions, bounds[1]), slices.Index(positions, position)
		if start >= 0 && end >= start && index >= start && index <= end {
			return true
		}
	}
	return false
}
