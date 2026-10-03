package cli

import (
	"context"
	"fmt"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func (runner *Runner) runTag(ctx context.Context) error {
	if err := runner.prepareRun(); err != nil {
		return err
	}
	if runner.options.Debug {
		if _, err := fmt.Fprintf(runner.output, "Touhou Tagger %s\nGo metadata config: %+v\n", runner.versionText(), config.RuntimeMetadata(runner.options.Metadata)); err != nil {
			return err
		}
	}
	return runner.runDirectories(ctx, runner.tagDirectory)
}

func (runner *Runner) tagDirectory(
	ctx context.Context,
	directory string,
	batch bool,
) error {
	if err := runner.reportProgress(domain.ProgressEvent{Stage: domain.StageScan, Directory: directory}); err != nil {
		return err
	}
	album, err := application.OpenAlbum(ctx, directory, runner.options.RuntimeAlbumOptions)
	if err != nil {
		return err
	}
	options := album.Options
	options.Interactive = options.Interactive && !runner.options.NoInteractive
	service, err := runner.service(options.Metadata)
	if err != nil {
		return err
	}
	scan := album.Scan
	albumName := album.Name
	if !batch && options.Interactive {
		answer, err := runner.prompt(ctx, fmt.Sprintf("请输入专辑名称(%s): ", albumName))
		if err != nil {
			return err
		}
		if answer != "" {
			albumName = answer
		}
	}
	candidate := domain.AlbumCandidate{ID: scan.MetadataPath, Name: albumName, Source: "local-json"}
	if scan.MetadataPath == "" {
		candidates, err := service.SearchCandidates(ctx, albumName, options.Metadata.Source)
		if err != nil {
			return err
		}
		var selected bool
		candidate, selected, err = runner.selectCandidate(ctx, candidates, albumName, options.Interactive)
		if err != nil {
			return err
		}
		if !selected {
			return nil
		}
	}
	data, err := service.GetAlbumMetadata(ctx, scan, candidate)
	if err != nil {
		return err
	}
	if candidate.Source == "local-json" && len(data.Metadata) > 0 {
		candidate.Name = data.Metadata[0].Album
	}
	planOptions := application.PlanOptions{
		Candidate: candidate, DefaultAlbumName: album.Name, DefaultSource: runner.defaultSource,
	}
	if options.Cover && len(data.Cover) > 0 {
		path, err := application.CoverPath(directory, data.Cover)
		if err != nil {
			return err
		}
		planOptions.Cover = &application.CoverOutput{Path: path, Data: data.Cover, Replace: true}
	}
	plan, err := service.CreatePlan(ctx, scan, data.Metadata, planOptions)
	if err != nil {
		return err
	}
	if _, err := plan.Execute(ctx, service.Events); err != nil {
		return err
	}

	_, err = fmt.Fprintf(runner.errors, "成功写入了专辑信息: %s\n", candidate.Name)
	return err
}
