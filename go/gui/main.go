package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"time"

	"github.com/the1812/Touhou-Tagger/go/gui/internal/bridge"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/imagecodec"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/embed
var embeddedAssets embed.FS

func main() {
	assets, err := fs.Sub(embeddedAssets, "frontend/embed/dist")
	if err != nil {
		log.Fatalf("load frontend assets: %v", err)
	}
	storedConfig, err := config.Load()
	if err != nil {
		log.Fatalf("load configuration: %v", err)
	}
	codec, err := imagecodec.New(context.Background(), imagecodec.Options{})
	if err != nil {
		log.Fatalf("initialize image pipeline: %v", err)
	}
	factory, sources, err := runtimeOptions(codec)
	if err != nil {
		log.Fatalf("initialize GUI runtime: %v", err)
	}
	backend := bridge.NewBackend(bridge.BackendOptions{
		Context:          context.Background(),
		Config:           storedConfig,
		Factory:          factory,
		Sources:          sources,
		StartupDirectory: startupDirectory(),
	})
	staticAssets := application.AssetFileServerFS(assets)
	savedWindowState, err := loadWindowState()
	if err != nil {
		log.Printf("load GUI state: %v", err)
	}

	app := application.New(application.Options{
		Name:        "Touhou Tagger",
		Description: "Touhou Tagger",
		Assets: application.AssetOptions{
			Handler: backend.AssetHandler(staticAssets),
		},
	})

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Touhou Tagger",
		Width:            savedWindowState.Width,
		Height:           savedWindowState.Height,
		MinWidth:         minimumWindowWidth,
		MinHeight:        minimumWindowHeight,
		BackgroundColour: application.NewRGB(248, 245, 241),
		URL:              "/",
	})
	if savedWindowState.Maximised {
		window.Maximise()
	}
	windowState := newWindowStateTracker(savedWindowState, window)
	backend.Attach(app, window)
	serviceOptions := application.ServiceOptions{MarshalError: bridge.MarshalError}
	app.RegisterService(application.NewServiceWithOptions(backend.Workspace, serviceOptions))
	app.RegisterService(application.NewServiceWithOptions(backend.Batch, serviceOptions))
	app.RegisterService(application.NewServiceWithOptions(backend.Settings, serviceOptions))
	app.OnShutdown(func() {
		backend.Close()
		if err := windowState.save(window); err != nil {
			log.Printf("save GUI state: %v", err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := codec.Close(ctx); err != nil {
			log.Printf("close image pipeline: %v", err)
		}
	})

	if err := app.Run(); err != nil {
		log.Fatalf("run application: %v", err)
	}
}
