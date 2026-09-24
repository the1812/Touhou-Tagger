package application

import (
	"context"
	"fmt"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/filesystem"
)

type Album struct {
	Scan   domain.AlbumScan
	Config config.ResolvedAlbumConfig
	Name   string
}

func OpenAlbum(ctx context.Context, directory string, base domain.MetadataConfig) (Album, error) {
	scan, err := filesystem.ScanAlbum(ctx, directory)
	if err != nil {
		return Album{}, err
	}
	resolved, err := config.ResolveAlbum(scan.Directory, base, base.LyricEnabled)
	if err != nil {
		return Album{}, err
	}
	if scan.MetadataPath != "" {
		resolved.Metadata.Source = "local-json"
	}
	return Album{Scan: scan, Config: resolved, Name: albumName(scan.Directory, resolved.DefaultAlbumHint)}, nil
}

type CoverOutput struct {
	Path    string
	Data    []byte
	Replace bool
}

type AlbumCommit struct {
	Plan             domain.TagPlan
	Candidate        domain.AlbumCandidate
	DefaultAlbumName string
	DefaultSource    string
	Cover            *CoverOutput
}

type AlbumResult struct {
	AudioRenamed bool
	Reusable     bool
	Written      int
	Renamed      int
	CoversSaved  int
	LRCFiles     int
	CoverPath    string
}

func (service *Service) CommitAlbum(ctx context.Context, commit AlbumCommit) (AlbumResult, error) {
	result := AlbumResult{Reusable: true}
	plan := commit.Plan
	applied, err := service.ApplyTagPlan(ctx, plan)
	result.AudioRenamed = applied.Renamed
	if err != nil {
		result.Reusable = applied.Renamed || !TagFilesMayHaveChanged(err)
		return result, err
	}
	result.Written = len(plan.Items)
	result.LRCFiles = len(TagPlanOutputs(plan, service.Config))
	for _, item := range plan.Items {
		if normalizedPath(item.SourcePath) != normalizedPath(item.TargetPath) {
			result.Renamed++
		}
	}
	if cover := commit.Cover; cover != nil {
		if cover.Replace {
			_, err = SaveCoverAt(cover.Path, cover.Data)
		} else {
			err = writeNewFile(cover.Path, cover.Data, 0o644)
		}
		if err != nil {
			return result, fmt.Errorf("write cover %q: %w", cover.Path, err)
		}
		result.CoverPath = cover.Path
		result.CoversSaved = 1
	}
	if commit.Candidate.Source != "local-json" {
		hint := ""
		if commit.Candidate.Name != "" && commit.Candidate.Name != commit.DefaultAlbumName {
			hint = commit.Candidate.Name
		}
		source := commit.Candidate.Source
		if source == commit.DefaultSource {
			source = ""
		}
		if err := config.SaveAlbumSelection(plan.Directory, source, hint); err != nil {
			return result, err
		}
	}
	err = service.emit(domain.ProgressEvent{
		Stage: domain.StageComplete, Directory: plan.Directory,
		Current: len(plan.Items), Total: len(plan.Items),
	})
	return result, err
}
