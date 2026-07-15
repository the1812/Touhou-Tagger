package main

import (
	"embed"
	"io/fs"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/embed
var embeddedAssets embed.FS

func main() {
	assets, err := fs.Sub(embeddedAssets, "frontend/embed/dist")
	if err != nil {
		log.Fatalf("load frontend assets: %v", err)
	}

	app := application.New(application.Options{
		Name:        "Touhou Tagger",
		Description: "Touhou Project music metadata tagger",
		Services: []application.Service{
			application.NewService(&App{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Touhou Tagger",
		Width:            800,
		Height:           500,
		BackgroundColour: application.NewRGB(248, 245, 241),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatalf("run application: %v", err)
	}
}
