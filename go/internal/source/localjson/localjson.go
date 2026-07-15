package localjson

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/tailscale/hujson"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type Source struct{}

func (Source) Search(
	ctx context.Context,
	query string,
) ([]domain.AlbumCandidate, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	path, err := filepath.Abs(query)
	if err != nil {
		return nil, fmt.Errorf("resolve metadata path: %w", err)
	}
	if _, err := os.Stat(path); err != nil {
		return nil, fmt.Errorf("open local metadata %q: %w", path, err)
	}
	return []domain.AlbumCandidate{{ID: path, Name: filepath.Base(path), Source: "local-json"}}, nil
}

func (Source) Fetch(
	ctx context.Context,
	id string,
	cover []byte,
) ([]domain.Metadata, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(id)
	if err != nil {
		return nil, fmt.Errorf("read local metadata %q: %w", id, err)
	}
	if strings.EqualFold(filepath.Ext(id), ".jsonc") {
		data, err = hujson.Standardize(data)
		if err != nil {
			return nil, fmt.Errorf("parse local JSONC %q: %w", id, err)
		}
	}
	var metadata []domain.Metadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("parse local metadata %q: %w", id, err)
	}
	return domain.ExpandMetadata(metadata, cover), nil
}
