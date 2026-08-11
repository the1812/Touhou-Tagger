//go:build !server

package main

import (
	"github.com/the1812/Touhou-Tagger/go/gui/internal/bridge"
	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/bootstrap"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

func runtimeOptions(
	coverProcessor tagio.CoverProcessor,
) (bridge.ServiceFactory, []bridge.SourceOption, error) {
	factory := func(
		config domain.MetadataConfig,
		events coreapp.EventSink,
	) (*coreapp.Service, error) {
		return bootstrap.NewService(bootstrap.Options{
			Config:         config,
			Events:         events,
			CoverProcessor: coverProcessor,
		})
	}
	return factory, []bridge.SourceOption{
		{Value: "thb-wiki", Label: "THBWiki", SupportsSearch: true},
		{Value: "doujin-meta", Label: "Doujin Meta", SupportsSearch: true},
		{Value: "local-json", Label: "本地 metadata.json", SupportsSearch: false},
	}, nil
}

func startupDirectory() string {
	return ""
}
