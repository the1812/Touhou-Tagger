package cli

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type BuildInfo struct {
	Version string
	Commit  string
	Date    string
}

type Runner struct {
	terminal
	build         BuildInfo
	options       Options
	defaultSource string
	service       func(domain.MetadataConfig) (*application.Service, error)
}

func (runner *Runner) prepareRun() error {
	if err := validateOptions(runner.options); err != nil {
		return err
	}
	return config.Save(runner.options.persistedConfig())
}

func (runner *Runner) runDirectories(ctx context.Context, run func(context.Context, string, bool) error) error {
	if runner.options.Batch == "" {
		directory, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("resolve working directory: %w", err)
		}
		return run(ctx, directory, false)
	}
	service, err := runner.service(runner.options.Metadata)
	if err != nil {
		return err
	}
	entries, err := service.ScanBatch(ctx, runner.options.Batch, runner.options.BatchDepth)
	if err != nil {
		return err
	}
	results := service.RunBatch(ctx, entries, func(ctx context.Context, entry domain.BatchScanEntry) error {
		return run(ctx, entry.Directory, true)
	})
	var failures []error
	for _, result := range results {
		if result.Err != nil {
			failures = append(failures, fmt.Errorf("%s: %w", result.Entry.Directory, result.Err))
		}
	}
	if len(failures) > 0 {
		return fmt.Errorf("%d batch albums failed: %w", len(failures), errors.Join(failures...))
	}
	return nil
}

func (runner *Runner) reportProgress(event domain.ProgressEvent) error {
	return runner.terminal.reportProgress(event, runner.options.Debug)
}
