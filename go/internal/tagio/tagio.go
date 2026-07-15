package tagio

import (
	"context"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type CoverProcessor interface {
	Compress(context.Context, []byte, domain.CoverOptions) ([]byte, error)
}

type Reader interface {
	Read(context.Context, string, domain.MetadataConfig) (domain.Metadata, error)
}

type Writer interface {
	Write(context.Context, string, domain.Metadata, domain.MetadataConfig) error
}

type Readers map[domain.AudioFormat]Reader

type Writers map[domain.AudioFormat]Writer
