package application

import (
	"context"
	"maps"
	"slices"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
)

type CoverOutput struct {
	Path    string
	Data    []byte
	Replace bool
}

type PlanOptions struct {
	Candidate        domain.AlbumCandidate
	DefaultAlbumName string
	DefaultSource    string
	Cover            *CoverOutput
}

type PlanPreview struct {
	Directory string
	Items     []domain.PlanItem
	Outputs   []PlanOutput
	Conflicts []PlanOutputConflict
}

type Plan struct {
	preview PlanPreview
	options PlanOptions
	config  domain.MetadataConfig
	writers tagio.Writers
}

func (service *Service) CreatePlan(
	ctx context.Context,
	scan domain.AlbumScan,
	metadata []domain.Metadata,
	options PlanOptions,
) (*Plan, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	tracks := make([]domain.Metadata, len(metadata))
	for index, item := range metadata {
		tracks[index] = item.Clone()
	}
	preview, err := createPreview(scan, tracks)
	if err != nil {
		return nil, err
	}
	value := service.Config
	if value.Lyric != nil {
		lyric := *value.Lyric
		value.Lyric = &lyric
	}
	preview.Outputs = lyricOutputs(preview, value)
	if options.Cover != nil {
		cover := *options.Cover
		cover.Data = slices.Clone(cover.Data)
		options.Cover = &cover
		preview.Outputs = append(preview.Outputs, PlanOutput{
			Kind: OutputCover, Path: cover.Path, ItemIndex: -1, Replace: cover.Replace,
		})
	}
	preview.Conflicts = InspectPlanOutputs(preview.Outputs)
	if err := service.emit(domain.ProgressEvent{
		Stage: domain.StagePlan, Directory: scan.Directory, Total: len(preview.Items),
	}); err != nil {
		return nil, err
	}
	return &Plan{
		preview: preview, options: options, config: value,
		writers: maps.Clone(service.Writers),
	}, nil
}

func (plan *Plan) Preview() PlanPreview {
	preview := plan.preview
	preview.Items = slices.Clone(preview.Items)
	for index := range preview.Items {
		preview.Items[index].Metadata = preview.Items[index].Metadata.Clone()
	}
	preview.Outputs = slices.Clone(preview.Outputs)
	preview.Conflicts = slices.Clone(preview.Conflicts)
	return preview
}
