package bootstrap

import (
	"net/http"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
	"github.com/the1812/Touhou-Tagger/go/internal/source/doujinmeta"
	"github.com/the1812/Touhou-Tagger/go/internal/source/localjson"
	"github.com/the1812/Touhou-Tagger/go/internal/source/thbwiki"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
	flactag "github.com/the1812/Touhou-Tagger/go/internal/tagio/flac"
	id3tag "github.com/the1812/Touhou-Tagger/go/internal/tagio/id3"
)

const (
	DefaultTHBWikiURL    = "https://thbwiki.cc"
	DefaultDoujinMetaURL = "https://doujin-meta.vercel.app"
)

type Options struct {
	Config         domain.MetadataConfig
	Events         application.EventSink
	Warnings       application.WarningSink
	CoverProcessor tagio.CoverProcessor
	Client         *http.Client
	Sources        source.Registry
	THBWikiURL     string
	DoujinMetaURL  string
}

func NewService(options Options) (*application.Service, error) {
	runtimeConfig := config.RuntimeMetadata(options.Config)
	sources := options.Sources
	if sources == nil {
		client := options.Client
		if client == nil {
			client = &http.Client{Timeout: time.Duration(runtimeConfig.Timeout) * time.Second}
		}
		thbWikiURL := options.THBWikiURL
		if thbWikiURL == "" {
			thbWikiURL = DefaultTHBWikiURL
		}
		doujinMetaURL := options.DoujinMetaURL
		if doujinMetaURL == "" {
			doujinMetaURL = DefaultDoujinMetaURL
		}
		wiki, err := thbwiki.New(client, thbWikiURL, runtimeConfig)
		if err != nil {
			return nil, err
		}
		doujin, err := doujinmeta.New(client, doujinMetaURL)
		if err != nil {
			return nil, err
		}
		sources = source.Registry{
			"thb-wiki":    wiki,
			"doujin-meta": doujin,
			"local-json":  localjson.Source{},
		}
	}
	return &application.Service{
		Config:   runtimeConfig,
		Events:   options.Events,
		Warnings: options.Warnings,
		Sources:  sources,
		Readers: tagio.Readers{
			domain.FormatMP3:  id3tag.Reader{},
			domain.FormatFLAC: flactag.Reader{},
		},
		Writers: tagio.Writers{
			domain.FormatMP3:  id3tag.Writer{CoverProcessor: options.CoverProcessor},
			domain.FormatFLAC: flactag.Writer{CoverProcessor: options.CoverProcessor},
		},
	}, nil
}
