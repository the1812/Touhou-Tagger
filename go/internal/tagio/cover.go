package tagio

import (
	"context"
	"fmt"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func ProcessCover(
	ctx context.Context,
	processor CoverProcessor,
	cover []byte,
	config domain.MetadataConfig,
) ([]byte, error) {
	if len(cover) == 0 || config.CoverCompressSize <= 0 {
		return cover, nil
	}
	threshold := int64(config.CoverCompressSize * 1024 * 1024)
	if int64(len(cover)) <= threshold {
		return cover, nil
	}
	if processor == nil {
		return nil, fmt.Errorf("cover exceeds compression threshold but image codec is unavailable")
	}
	compressed, err := processor.Compress(ctx, cover, domain.CoverOptions{
		MaxDimension: config.CoverCompressResolution,
	})
	if err != nil {
		return nil, fmt.Errorf("compress embedded cover: %w", err)
	}
	return compressed, nil
}
