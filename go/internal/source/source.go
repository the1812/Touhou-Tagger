package source

import (
	"context"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

const MaxSearchCount = 20

type SearchOptions struct {
	IncludeThumbnails bool
}

type MetadataSource interface {
	SearchCandidates(context.Context, string, SearchOptions) ([]domain.AlbumCandidate, error)
	GetMetadata(context.Context, string, []byte) ([]domain.Metadata, error)
}

type Registry map[string]MetadataSource
