package musicbrainz

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

var requests = source.NewRequestLimiter(1100 * time.Millisecond)

type Source struct {
	client *resty.Client
	images *resty.Client
}

type artist struct {
	Name string `json:"name"`
}

type artistCredit struct {
	Name   string `json:"name"`
	Artist artist `json:"artist"`
}

type relation struct {
	Type         string  `json:"type"`
	TargetCredit string  `json:"target-credit"`
	Artist       *artist `json:"artist"`
	Work         *struct {
		Relations []relation `json:"relations"`
	} `json:"work"`
}

type recording struct {
	Title        string         `json:"title"`
	Video        bool           `json:"video"`
	ArtistCredit []artistCredit `json:"artist-credit"`
	Genres       []artist       `json:"genres"`
	Relations    []relation     `json:"relations"`
}

type release struct {
	ID             string         `json:"id"`
	Title          string         `json:"title"`
	Date           string         `json:"date"`
	Country        string         `json:"country"`
	Disambiguation string         `json:"disambiguation"`
	ArtistCredit   []artistCredit `json:"artist-credit"`
	LabelInfo      []struct {
		CatalogNumber string `json:"catalog-number"`
	} `json:"label-info"`
	Genres          []artist `json:"genres"`
	CoverArtArchive struct {
		Front bool `json:"front"`
	} `json:"cover-art-archive"`
	Media []struct {
		Position int    `json:"position"`
		Format   string `json:"format"`
		Tracks   []struct {
			Position     int            `json:"position"`
			Title        string         `json:"title"`
			ArtistCredit []artistCredit `json:"artist-credit"`
			Recording    recording      `json:"recording"`
		} `json:"tracks"`
	} `json:"media"`
}

func New(client *http.Client) *Source {
	api := source.NewHTTPClient(client).SetBaseURL("https://musicbrainz.org/ws/2")
	api.OnBeforeRequest(func(_ *resty.Client, request *resty.Request) error {
		return requests.Wait(request.Context())
	})
	return &Source{client: api, images: source.NewHTTPClient(client)}
}

func (provider *Source) SearchCandidates(ctx context.Context, query string) ([]domain.AlbumCandidate, error) {
	phrase := `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(query) + `"`
	var result struct {
		Releases []release `json:"releases"`
	}
	if _, err := provider.client.R().SetContext(ctx).SetQueryParams(map[string]string{
		"query": "release:" + phrase + " OR catno:" + phrase, "limit": strconv.Itoa(source.MaxSearchCount), "fmt": "json",
	}).SetResult(&result).Get("/release"); err != nil {
		return nil, fmt.Errorf("search MusicBrainz: %w", err)
	}
	candidates := make([]domain.AlbumCandidate, 0, len(result.Releases))
	for _, item := range result.Releases {
		var formats []string
		for _, medium := range item.Media {
			if medium.Format != "" && !slices.Contains(formats, medium.Format) {
				formats = append(formats, medium.Format)
			}
		}
		artists := artistNames(item.ArtistCredit)
		parts := []string{strings.Join(artists, " / "), item.Date, catalogNumbers(item), item.Country, strings.Join(formats, " / "), item.Disambiguation, item.ID}
		parts = slices.DeleteFunc(parts, func(value string) bool { return value == "" })
		candidates = append(candidates, domain.AlbumCandidate{
			ID: item.ID, Name: item.Title, Source: "music-brainz", Artists: artists, Description: strings.Join(parts, " · "),
			ThumbnailURL: "https://coverartarchive.org/release/" + url.PathEscape(item.ID) + "/front-500",
		})
	}
	return candidates, nil
}

func (provider *Source) GetMetadata(ctx context.Context, id string, cover []byte) ([]domain.Metadata, error) {
	var album release
	if _, err := provider.client.R().SetContext(ctx).SetQueryParams(map[string]string{
		"fmt": "json",
		"inc": "recordings+artist-credits+labels+genres+recording-level-rels+work-level-rels+work-rels+artist-rels",
	}).SetResult(&album).Get("/release/" + url.PathEscape(id)); err != nil {
		return nil, fmt.Errorf("fetch MusicBrainz release %q: %w", id, err)
	}
	albumArtists := artistNames(album.ArtistCredit)
	var metadata []domain.Metadata
	for _, medium := range album.Media {
		for _, track := range medium.Tracks {
			if track.Recording.Video {
				continue
			}
			credits := track.ArtistCredit
			if credits == nil {
				credits = track.Recording.ArtistCredit
			}
			artists := artistNames(credits)
			if len(artists) == 0 {
				artists = slices.Clone(albumArtists)
			}
			relations := slices.Clone(track.Recording.Relations)
			for _, item := range track.Recording.Relations {
				if item.Work != nil {
					relations = append(relations, item.Work.Relations...)
				}
			}
			genres := track.Recording.Genres
			if len(genres) == 0 {
				genres = album.Genres
			}
			var genreNames []string
			for _, genre := range genres {
				genreNames = append(genreNames, genre.Name)
			}
			title := track.Title
			if title == "" {
				title = track.Recording.Title
			}
			metadata = append(metadata, domain.Metadata{
				Album: album.Title, AlbumOrder: catalogNumbers(album), AlbumArtists: slices.Clone(albumArtists),
				Year: album.Date[:min(4, len(album.Date))], Title: title,
				DiscNumber: strconv.Itoa(medium.Position), TrackNumber: strconv.Itoa(track.Position),
				Artists: artists, Genres: genreNames,
				Composers: creditNames(relations, "composer"), Lyricists: creditNames(relations, "lyricist"),
			})
		}
	}
	if len(metadata) == 0 {
		return nil, fmt.Errorf("MusicBrainz release %q has no audio tracks", id)
	}
	if len(cover) == 0 && album.CoverArtArchive.Front {
		response, err := provider.images.R().SetContext(ctx).Get("https://coverartarchive.org/release/" + url.PathEscape(id) + "/front")
		if err != nil {
			var status *source.HTTPStatusError
			if !errors.As(err, &status) || status.StatusCode != http.StatusNotFound {
				return nil, fmt.Errorf("fetch MusicBrainz cover: %w", err)
			}
		} else {
			cover = response.Body()
		}
	}
	return domain.ExpandMetadata(metadata, cover), nil
}

func artistNames(credits []artistCredit) []string {
	names := make([]string, 0, len(credits))
	for _, credit := range credits {
		name := credit.Name
		if name == "" {
			name = credit.Artist.Name
		}
		names = append(names, name)
	}
	return names
}

func catalogNumbers(album release) string {
	var numbers []string
	for _, label := range album.LabelInfo {
		if label.CatalogNumber != "" && !slices.Contains(numbers, label.CatalogNumber) {
			numbers = append(numbers, label.CatalogNumber)
		}
	}
	return strings.Join(numbers, " / ")
}

func creditNames(relations []relation, role string) []string {
	var names []string
	for _, credit := range relations {
		if credit.Type != role || credit.Artist == nil {
			continue
		}
		name := credit.TargetCredit
		if name == "" {
			name = credit.Artist.Name
		}
		if !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	return names
}
