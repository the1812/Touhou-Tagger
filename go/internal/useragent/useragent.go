package useragent

import "strings"

const repository = "https://github.com/the1812/Touhou-Tagger"

var version = "dev"

func SetVersion(value string) {
	value = strings.TrimPrefix(strings.TrimSpace(value), "v")
	if value != "" {
		version = value
	}
}

func TouhouTagger() string {
	return "touhou-tagger/" + version + " (" + repository + ")"
}
