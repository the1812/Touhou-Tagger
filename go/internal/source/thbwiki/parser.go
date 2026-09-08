package thbwiki

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"golang.org/x/net/html"
)

type trackInfo struct {
	name   string
	values []string
	value  string
}

var (
	invalidNamePattern = regexp.MustCompile(`包含无效字符或不完整，并因此在查询或注释过程期间导致意外结果。\[\[(.+)\]\]`)
	roleSuffixPattern  = regexp.MustCompile(`（.+）$`)
	leadingNumber      = regexp.MustCompile(`^\s*(\d+)`)
	spaceBeforeASCII   = regexp.MustCompile(`([^\s])([(])`)
	spaceAfterASCII    = regexp.MustCompile(`([)])([^\s])`)
	spaceBeforeCJK     = regexp.MustCompile(`([^\s]) ([（])`)
	spaceAfterCJK      = regexp.MustCompile(`([）]) ([^\s])`)
)

func findTrackNumberCell(row *goquery.Selection) *goquery.Selection {
	return row.ChildrenFiltered("td").FilterFunction(func(_ int, cell *goquery.Selection) bool {
		className, exists := cell.Attr("class")
		if !exists {
			return false
		}
		for _, class := range strings.Fields(className) {
			if strings.HasPrefix(class, "info") {
				return true
			}
		}
		return false
	}).First()
}

func (wiki *Source) parseTrack(
	ctx context.Context,
	row *goquery.Selection,
) (domain.Metadata, error) {
	match := leadingNumber.FindStringSubmatch(findTrackNumberCell(row).Text())
	if len(match) < 2 {
		return domain.Metadata{}, &domain.ParseError{Kind: domain.RemoteResponse, Err: fmt.Errorf("parse THBWiki track number from %q", findTrackNumberCell(row).Text())}
	}
	number, err := strconv.Atoi(match[1])
	if err != nil {
		return domain.Metadata{}, &domain.ParseError{Kind: domain.RemoteResponse, Err: fmt.Errorf("parse THBWiki track number %q: %w", match[1], err)}
	}
	title := strings.TrimSpace(row.Find(".title").First().Text())
	metadata := domain.Metadata{Title: title, TrackNumber: strconv.Itoa(number)}
	if wiki.config.Lyric != nil {
		if lyricURL := wiki.findLyricURL(row); lyricURL != "" {
			lyric, language, lyricErr := wiki.lyrics.Download(ctx, lyricURL, title)
			if lyricErr != nil {
				return domain.Metadata{}, fmt.Errorf("fetch lyrics for %q: %w", title, lyricErr)
			}
			metadata.Lyric = lyric
			metadata.LyricLanguage = language
		}
	}
	infos := make([]trackInfo, 0)
	for _, related := range relatedRows(row) {
		info := parseRelatedRow(related)
		if info.name != "" {
			infos = append(infos, info)
		}
	}
	arrangers := collectInfo(infos, "remix", "arrangers", "scripts")
	composers := collectInfo(infos, "composers")
	if len(arrangers) == 0 && len(composers) > 0 {
		arrangers = append(arrangers, composers...)
	}
	performers := collectInfo(
		infos,
		"vocals", "coverVocals", "harmonyVocals", "accompanyVocals",
		"chorusVocals", "instruments", "voices",
	)
	metadata.Artists = normalizeNames(unique(append(performers, arrangers...)), true)
	metadata.Composers = normalizeNames(composers, true)
	metadata.Lyricists = normalizeNames(collectInfo(infos, "lyricists"), true)
	metadata.Title = normalizeValue(metadata.Title, false)
	metadata.Comments = normalizeValue(firstValue(infos, "comments"), false)
	return metadata, nil
}

func (wiki *Source) findLyricURL(row *goquery.Selection) string {
	result := ""
	row.Find("a").EachWithBreak(func(_ int, link *goquery.Selection) bool {
		if link.HasClass("external") || link.HasClass("new") || link.ParentsFiltered(".new").Length() > 0 {
			return true
		}
		href, exists := link.Attr("href")
		if !exists || href == "" {
			return true
		}
		decoded, err := url.PathUnescape(href)
		if err != nil {
			decoded = href
		}
		if !strings.Contains(decoded, "歌词:") {
			return true
		}
		resolved, err := wiki.base.Parse(href)
		if err == nil {
			result = resolved.String()
			return false
		}
		return true
	})
	return result
}

func relatedRows(row *goquery.Selection) []*goquery.Selection {
	if len(row.Nodes) == 0 {
		return nil
	}
	var rows []*goquery.Selection
	for node := row.Nodes[0].NextSibling; node != nil; node = node.NextSibling {
		if node.Type != html.ElementNode {
			continue
		}
		if node.Data != "tr" {
			break
		}
		selection := goquery.NewDocumentFromNode(node).Selection
		if selection.Find(".left").Length() == 0 {
			break
		}
		rows = append(rows, selection)
	}
	return rows
}

func parseRelatedRow(row *goquery.Selection) trackInfo {
	label := strings.TrimSpace(row.Find(".label").First().Text())
	data := row.Find(".text").First()
	switch label {
	case "编曲":
		return parseDefaultInfo("arrangers", data)
	case "再编曲":
		return parseDefaultInfo("remix", data)
	case "作曲":
		return parseDefaultInfo("composers", data)
	case "剧本":
		return parseDefaultInfo("scripts", data)
	case "演唱":
		return parseDefaultInfo("vocals", data)
	case "翻唱":
		return parseDefaultInfo("coverVocals", data)
	case "和声":
		return parseDefaultInfo("harmonyVocals", data)
	case "伴唱":
		return parseDefaultInfo("accompanyVocals", data)
	case "合唱":
		return parseDefaultInfo("chorusVocals", data)
	case "作词":
		return parseDefaultInfo("lyricists", data)
	case "配音":
		return parseVoices(data)
	case "演奏":
		return parseInstruments(data)
	case "原曲":
		return trackInfo{name: "comments", value: parseOriginalSongs(data)}
	default:
		return trackInfo{}
	}
}

func parseDefaultInfo(name string, data *goquery.Selection) trackInfo {
	value := strings.TrimSpace(textUntilBreak(data))
	if match := invalidNamePattern.FindStringSubmatch(value); len(match) > 1 {
		value = match[1]
	}
	values := splitValues(value)
	for index, item := range values {
		if _, remainder, found := strings.Cut(item, "："); found {
			values[index] = remainder
		}
	}
	return trackInfo{name: name, values: values}
}

func parseVoices(data *goquery.Selection) trackInfo {
	segments := splitNodesByBreak(data)
	voices := make([]string, 0)
	for _, segment := range segments {
		anchors := anchorsIn(segment)
		real := make([]string, 0)
		for _, anchor := range anchors {
			before, after := textAround(segment, anchor)
			if strings.HasSuffix(strings.TrimSpace(before), "（") && strings.HasPrefix(strings.TrimSpace(after), "）") {
				real = append(real, strings.TrimSpace(nodeText(anchor)))
			}
		}
		if len(real) > 0 {
			voices = append(voices, real...)
		} else {
			for _, anchor := range anchors {
				voices = append(voices, strings.TrimSpace(nodeText(anchor)))
			}
		}
	}
	return trackInfo{name: "voices", values: compact(voices)}
}

func parseInstruments(data *goquery.Selection) trackInfo {
	performers := make([]string, 0)
	for _, segment := range splitNodesByBreak(data) {
		value := strings.TrimSpace(nodesText(segment))
		if _, remainder, found := strings.Cut(value, "："); found {
			value = remainder
		}
		performers = append(performers, splitValues(value)...)
	}
	return trackInfo{name: "instruments", values: performers}
}

func parseOriginalSongs(data *goquery.Selection) string {
	result := "原曲: "
	items := data.Find(".ogmusic,.source")
	items.Each(func(index int, item *goquery.Selection) {
		if item.HasClass("ogmusic") {
			result += strings.TrimSpace(item.Text())
			if index < items.Length()-1 && items.Eq(index+1).HasClass("ogmusic") {
				result += ", "
			}
			return
		}
		result += " (" + strings.TrimSpace(item.Text()) + ")"
		if index != items.Length()-1 {
			result += ", "
		}
	})
	return result
}

func textUntilBreak(selection *goquery.Selection) string {
	if len(selection.Nodes) == 0 {
		return ""
	}
	var builder strings.Builder
	for child := selection.Nodes[0].FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode && child.Data == "br" {
			break
		}
		builder.WriteString(nodeText(child))
	}
	return builder.String()
}

func splitNodesByBreak(selection *goquery.Selection) [][]*html.Node {
	if len(selection.Nodes) == 0 {
		return nil
	}
	segments := [][]*html.Node{{}}
	for child := selection.Nodes[0].FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode && child.Data == "br" {
			segments = append(segments, []*html.Node{})
			continue
		}
		segments[len(segments)-1] = append(segments[len(segments)-1], child)
	}
	return segments
}

func anchorsIn(nodes []*html.Node) []*html.Node {
	var anchors []*html.Node
	var visit func(*html.Node)
	visit = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "a" {
			anchors = append(anchors, node)
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	for _, node := range nodes {
		visit(node)
	}
	return anchors
}

func textAround(nodes []*html.Node, target *html.Node) (string, string) {
	var before strings.Builder
	var after strings.Builder
	found := false
	var visit func(*html.Node)
	visit = func(node *html.Node) {
		if node == target {
			found = true
			return
		}
		if node.Type == html.TextNode {
			if found {
				after.WriteString(node.Data)
			} else {
				before.WriteString(node.Data)
			}
			return
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	for _, node := range nodes {
		visit(node)
	}
	return before.String(), after.String()
}

func nodeText(node *html.Node) string {
	if node.Type == html.TextNode {
		return node.Data
	}
	var builder strings.Builder
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		builder.WriteString(nodeText(child))
	}
	return builder.String()
}

func nodesText(nodes []*html.Node) string {
	var builder strings.Builder
	for _, node := range nodes {
		builder.WriteString(nodeText(node))
	}
	return builder.String()
}

func splitValues(value string) []string {
	parts := strings.Split(value, "，")
	return compact(parts)
}

func compact(values []string) []string {
	result := values[:0]
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			result = append(result, value)
		}
	}
	return result
}

func collectInfo(infos []trackInfo, names ...string) []string {
	var result []string
	for _, name := range names {
		for _, info := range infos {
			if info.name == name {
				result = append(result, info.values...)
			}
		}
	}
	return result
}

func firstValue(infos []trackInfo, name string) string {
	for _, info := range infos {
		if info.name == name {
			return info.value
		}
	}
	return ""
}

func unique(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeNames(values []string, removeRole bool) []string {
	if values == nil {
		return nil
	}
	for index, value := range values {
		values[index] = normalizeValue(value, removeRole)
	}
	return unique(compact(values))
}

func normalizeValue(value string, removeRole bool) string {
	if replacement, exists := alternateNames[value]; exists {
		return replacement
	}
	if removeRole {
		value = roleSuffixPattern.ReplaceAllString(value, "")
	}
	value = strings.ReplaceAll(value, "\u200b", "")
	value = strings.ReplaceAll(value, "　", " ")
	value = spaceBeforeASCII.ReplaceAllString(value, "$1 $2")
	value = spaceAfterASCII.ReplaceAllString(value, "$1 $2")
	value = spaceBeforeCJK.ReplaceAllString(value, "$1$2")
	value = spaceAfterCJK.ReplaceAllString(value, "$1$2")
	value = strings.ReplaceAll(value, "’", "'")
	return strings.TrimSpace(value)
}
