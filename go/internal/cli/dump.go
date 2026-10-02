package cli

import (
	"context"
	"fmt"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func (runner *Runner) runDump(ctx context.Context) error {
	if err := runner.prepareRun(); err != nil {
		return err
	}
	return runner.runDirectories(ctx, runner.dumpDirectory)
}

func (runner *Runner) dumpDirectory(ctx context.Context, directory string, batch bool) error {
	if err := runner.reportProgress(domain.ProgressEvent{Stage: domain.StageScan, Directory: directory}); err != nil {
		return err
	}
	album, err := application.OpenAlbum(ctx, directory, runner.options.RuntimeAlbumOptions)
	if err != nil {
		return err
	}
	options := album.Options
	service, err := runner.service(options.Metadata)
	if err != nil {
		return err
	}
	if batch {
		if _, err := fmt.Fprintf(runner.errors, "[%s] 提取中\n", album.Name); err != nil {
			return err
		}
	}
	_, err = service.DumpMetadata(ctx, album.Scan, application.DumpOptions{Cover: options.Cover, Debug: runner.options.Debug})
	return err
}
