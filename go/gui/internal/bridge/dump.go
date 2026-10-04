package bridge

import (
	"context"
	"path/filepath"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type DumpService struct {
	runtime *runtimeState
	desktop *desktopService
	ops     *writeOperationManager
}

type DumpSummary struct {
	Directory  string `json:"directory"`
	Name       string `json:"name"`
	AudioCount int    `json:"audioCount"`
	MP3Count   int    `json:"mp3Count"`
	FLACCount  int    `json:"flacCount"`
	JSON       string `json:"json"`
}

type DumpResult struct {
	Directory  string `json:"directory"`
	AudioCount int    `json:"audioCount"`
}

func (service *DumpService) Scan(ctx context.Context, directory string) (DumpSummary, error) {
	album, err := coreapp.OpenAlbum(ctx, directory, config.RuntimeAlbumOptions{Metadata: service.runtime.getConfig()})
	if err != nil {
		return DumpSummary{}, err
	}
	applicationService, err := service.runtime.serviceWithConfig(album.Options.Metadata, nil)
	if err != nil {
		return DumpSummary{}, err
	}
	dump, err := applicationService.ReadDump(ctx, album.Scan, false)
	if err != nil {
		return DumpSummary{}, err
	}
	summary := DumpSummary{Directory: album.Scan.Directory, Name: album.Name, AudioCount: len(dump.Metadata), JSON: string(dump.JSON)}
	for _, audio := range album.Scan.AudioFiles {
		switch audio.Format {
		case domain.FormatMP3:
			summary.MP3Count++
		case domain.FormatFLAC:
			summary.FLACCount++
		}
	}
	return summary, nil
}

func (service *DumpService) SelectOutput(directory string, saveAs bool) (string, error) {
	if saveAs {
		return service.desktop.saveMetadataAs(directory)
	}
	return filepath.Join(directory, "metadata.json"), nil
}

func (service *DumpService) Extract(directory, path string) (DumpResult, error) {
	ctx, finish, err := service.ops.begin("dump", "dump")
	if err != nil {
		return DumpResult{}, err
	}
	defer finish()
	album, err := coreapp.OpenAlbum(ctx, directory, config.RuntimeAlbumOptions{Metadata: service.runtime.getConfig()})
	if err != nil {
		return DumpResult{}, err
	}
	applicationService, err := service.runtime.serviceWithConfig(album.Options.Metadata, nil)
	if err != nil {
		return DumpResult{}, err
	}
	metadata, err := applicationService.DumpMetadata(ctx, album.Scan, coreapp.DumpOptions{OutputPath: path, Cover: true})
	if err != nil {
		return DumpResult{}, err
	}
	return DumpResult{Directory: filepath.Dir(path), AudioCount: len(metadata)}, nil
}
