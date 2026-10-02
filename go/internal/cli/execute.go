package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/bootstrap"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/imagecodec"
	"github.com/the1812/Touhou-Tagger/go/internal/source/thbwiki"
)

func Execute(ctx context.Context, args []string, build BuildInfo) error {
	codec, err := imagecodec.New(ctx, imagecodec.Options{})
	if err != nil {
		return fmt.Errorf("initialize WASM image pipeline: %w", err)
	}
	runner := &Runner{
		terminal: terminal{input: bufio.NewReader(os.Stdin), output: os.Stdout, errors: os.Stderr},
		build:    build,
	}
	var lyrics thbwiki.LyricsCache
	runner.service = func(metadata domain.MetadataConfig) (*application.Service, error) {
		return bootstrap.NewService(bootstrap.Options{
			Config: metadata, CoverProcessor: codec, LyricsCache: &lyrics,
			Events: runner.reportProgress,
		})
	}
	command, err := runner.command(ctx)
	if err != nil {
		return errors.Join(err, codec.Close(context.WithoutCancel(ctx)))
	}
	command.SetArgs(normalizeArgs(args, command))
	runErr := command.ExecuteContext(ctx)
	closeErr := codec.Close(context.WithoutCancel(ctx))
	return errors.Join(runErr, closeErr)
}
