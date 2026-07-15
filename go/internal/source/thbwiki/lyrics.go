package thbwiki

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"sync"

	"github.com/PuerkitoBio/goquery"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"golang.org/x/net/html"
)

type cachedLyricsDocument struct {
	url      string
	document *goquery.Document
}

type lyricsService struct {
	wiki   *Source
	mutex  sync.Mutex
	cache  []cachedLyricsDocument
	cdBase *url.URL
}

type lyricRow struct {
	original       string
	translated     string
	originalLang   string
	translatedLang string
	time           string
	separator      bool
}

var (
	lyricsHeadingPrefix = regexp.MustCompile(`(?s)^\s*歌词\s*[:：]\s*`)
	formattingNewline   = regexp.MustCompile(`\n\s*`)
)

func newLyricsService(wiki *Source) *lyricsService {
	cdBase := *wiki.base
	hostname := strings.ToLower(cdBase.Hostname())
	if hostname == "thwiki.cc" || strings.HasSuffix(hostname, ".thwiki.cc") {
		cdBase.Scheme = "https"
		cdBase.Host = "cd.thwiki.cc"
	}
	return &lyricsService{wiki: wiki, cdBase: &cdBase}
}

func (service *lyricsService) Download(
	ctx context.Context,
	pageURL string,
	trackTitle string,
) (string, string, error) {
	document, err := service.document(ctx, pageURL)
	if err != nil {
		return "", "", err
	}
	tables := make([]*goquery.Selection, 0)
	document.Find(`.wikitable[class*="tt-type-lyric"]`).Each(func(_ int, table *goquery.Selection) {
		tables = append(tables, table)
	})
	if len(tables) == 0 {
		return "", "", fmt.Errorf("lyrics page %s contains no lyric table", pageURL)
	}
	selected := selectLyricTable(tables, trackTitle)
	config := *service.wiki.config.Lyric
	if config.Output == domain.LyricLRC {
		title := strings.TrimSpace(lyricsHeadingPrefix.ReplaceAllString(document.Find(".firstHeading").First().Text(), ""))
		if title == "" {
			return "", "", fmt.Errorf("lyrics page %s has no LRC title", pageURL)
		}
		language := lyricLanguage(selected.table, config)
		lyric, err := service.downloadLRC(ctx, title, selected.index, language, config.Type)
		if err != nil {
			return "", "", err
		}
		return lyric, language, nil
	}
	lyric, language := readLyrics(selected.table, config)
	return lyric, language, nil
}

func (service *lyricsService) document(
	ctx context.Context,
	pageURL string,
) (*goquery.Document, error) {
	service.mutex.Lock()
	for _, cached := range service.cache {
		if cached.url == pageURL {
			service.mutex.Unlock()
			return cached.document, nil
		}
	}
	service.mutex.Unlock()
	data, err := service.wiki.get(ctx, pageURL)
	if err != nil {
		return nil, fmt.Errorf("download lyrics page %s: %w", pageURL, err)
	}
	document, err := goquery.NewDocumentFromReader(strings.NewReader(string(data)))
	if err != nil {
		return nil, fmt.Errorf("parse lyrics page %s: %w", pageURL, err)
	}
	capacity := service.wiki.config.Lyric.MaxCacheSize
	if capacity <= 0 {
		capacity = domain.DefaultLyricConfig().MaxCacheSize
	}
	service.mutex.Lock()
	service.cache = append(service.cache, cachedLyricsDocument{url: pageURL, document: document})
	if len(service.cache) > capacity {
		service.cache = service.cache[len(service.cache)-capacity:]
	}
	service.mutex.Unlock()
	return document, nil
}

type selectedTable struct {
	table *goquery.Selection
	index int
}

func selectLyricTable(tables []*goquery.Selection, trackTitle string) selectedTable {
	for index := len(tables) - 1; index >= 0; index-- {
		version := tableVersion(tables[index])
		if version != "" && strings.Contains(trackTitle, version) {
			return selectedTable{table: tables[index], index: index}
		}
	}
	return selectedTable{table: tables[0], index: 0}
}

func tableVersion(table *goquery.Selection) string {
	if len(table.Nodes) == 0 {
		return ""
	}
	for node := table.Nodes[0].Parent; node != nil; node = node.Parent {
		for _, attribute := range node.Attr {
			if attribute.Key == "data-mw-tabber-title" {
				return strings.TrimSuffix(strings.TrimSpace(attribute.Val), "版")
			}
		}
	}
	return ""
}

func readLyrics(table *goquery.Selection, config domain.LyricConfig) (string, string) {
	rows := parseLyricRows(table)
	lines := make([]string, len(rows))
	for index, row := range rows {
		if row.separator {
			if config.Time && row.time != "" {
				lines[index] = "[" + row.time + "]"
			}
			continue
		}
		var value string
		switch config.Type {
		case domain.LyricTranslated:
			value = row.translated
			if value == "" {
				value = row.original
			}
		case domain.LyricMixed:
			value = row.original
			if row.translated != "" {
				value += config.TranslationSeparator + row.translated
			}
		case domain.LyricOriginal:
			value = row.original
		}
		if config.Time && row.time != "" {
			prefix := "[" + row.time + "] "
			if config.Type == domain.LyricMixed {
				parts := strings.Split(value, "\n")
				for partIndex := range parts {
					parts[partIndex] = prefix + parts[partIndex]
				}
				value = strings.Join(parts, "\n")
			} else {
				value = prefix + value
			}
		}
		lines[index] = value
	}
	return strings.Join(lines, "\n"), lyricLanguageFromRows(rows, config)
}

func lyricLanguage(table *goquery.Selection, config domain.LyricConfig) string {
	return lyricLanguageFromRows(parseLyricRows(table), config)
}

func lyricLanguageFromRows(rows []lyricRow, config domain.LyricConfig) string {
	if len(rows) == 0 {
		return ""
	}
	first := rows[0]
	switch config.Type {
	case domain.LyricTranslated:
		if first.translated != "" {
			return first.translatedLang
		}
		return first.originalLang
	case domain.LyricMixed:
		if first.translated != "" {
			return ""
		}
		return first.originalLang
	case domain.LyricOriginal:
		return first.originalLang
	}
	return ""
}

func parseLyricRows(table *goquery.Selection) []lyricRow {
	rows := make([]lyricRow, 0)
	table.Find("tr").Each(func(_ int, row *goquery.Selection) {
		if row.HasClass("tt-lyrics-header") {
			return
		}
		timeValue := strings.TrimSpace(row.Find("td.tt-time,td.tt-sep").First().Text())
		cells := row.Find("td").FilterFunction(func(_ int, cell *goquery.Selection) bool {
			return !cell.HasClass("tt-time") && !cell.HasClass("tt-sep")
		})
		original := cells.Eq(0)
		translated := cells.Eq(1)
		originalLang, _ := original.Attr("lang")
		translatedLang, _ := translated.Attr("lang")
		rows = append(rows, lyricRow{
			original:       normalizedCellText(original),
			translated:     normalizedCellText(translated),
			originalLang:   originalLang,
			translatedLang: translatedLang,
			time:           timeValue,
			separator:      row.HasClass("tt-lyrics-sep"),
		})
	})
	return rows
}

func normalizedCellText(cell *goquery.Selection) string {
	if len(cell.Nodes) == 0 {
		return ""
	}
	var builder strings.Builder
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "br" {
			builder.WriteByte('\n')
			return
		}
		if node.Type == html.TextNode {
			value := strings.ReplaceAll(node.Data, "\r", "")
			value = formattingNewline.ReplaceAllString(value, "")
			builder.WriteString(value)
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(cell.Nodes[0])
	rawLines := strings.Split(builder.String(), "\n")
	for index := range rawLines {
		rawLines[index] = strings.TrimSpace(rawLines[index])
	}
	return strings.TrimSpace(strings.Join(rawLines, "\n"))
}

func (service *lyricsService) downloadLRC(
	ctx context.Context,
	title string,
	index int,
	language string,
	lyricType domain.LyricType,
) (string, error) {
	indexSuffix := ""
	if index > 0 {
		indexSuffix = fmt.Sprintf(".%d", index+1)
	}
	languageSuffix := "."
	switch lyricType {
	case domain.LyricTranslated:
		languageSuffix = "." + language
	case domain.LyricMixed:
		languageSuffix = ".all"
	case domain.LyricOriginal:
	}
	suffix := indexSuffix + languageSuffix + ".lrc"
	endpoint := service.cdBase.ResolveReference(&url.URL{
		Path:    "/lyrics/" + title + suffix,
		RawPath: "/lyrics/" + url.PathEscape(title) + suffix,
	})
	data, err := service.wiki.get(ctx, endpoint.String())
	if err != nil {
		return "", fmt.Errorf("download LRC %s: %w", endpoint, err)
	}
	return string(data), nil
}
