package application

import (
	"context"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/filesystem"
)

type Album struct {
	Scan    domain.AlbumScan
	Options config.RuntimeAlbumOptions
	Name    string
}

func OpenAlbum(ctx context.Context, directory string, base config.RuntimeAlbumOptions) (Album, error) {
	scan, err := filesystem.ScanAlbum(ctx, directory)
	if err != nil {
		return Album{}, err
	}
	resolved, err := config.ResolveAlbum(scan.Directory, base)
	if err != nil {
		return Album{}, err
	}
	if scan.MetadataPath != "" {
		resolved.Metadata.Source = "local-json"
	}
	return Album{Scan: scan, Options: resolved, Name: albumName(scan.Directory, resolved.DefaultAlbumHint)}, nil
}
