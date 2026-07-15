package source

import (
	"context"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

const MaxSearchCount = 20

type MetadataSource interface {
	Search(context.Context, string) ([]domain.AlbumCandidate, error)
	Fetch(context.Context, string, []byte) ([]domain.Metadata, error)
}

type Registry map[string]MetadataSource
