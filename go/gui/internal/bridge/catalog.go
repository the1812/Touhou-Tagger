package bridge

import (
	"context"
	"fmt"
	"strings"
	"sync"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
)

type candidateCatalog struct {
	mu      sync.RWMutex
	byOwner map[string]map[string]AlbumCandidate
}

func newCandidateCatalog() *candidateCatalog {
	return &candidateCatalog{byOwner: make(map[string]map[string]AlbumCandidate)}
}

func (catalog *candidateCatalog) search(
	ctx context.Context,
	applicationService *coreapp.Service,
	owner string,
	query string,
	replace bool,
) ([]AlbumCandidate, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, fmt.Errorf("专辑名称不能为空")
	}
	candidates, err := applicationService.SearchAlbums(ctx, query, applicationService.Config.Source)
	if err != nil {
		return nil, err
	}
	result := make([]AlbumCandidate, len(candidates))
	catalog.mu.Lock()
	if replace || catalog.byOwner[owner] == nil {
		catalog.byOwner[owner] = make(map[string]AlbumCandidate)
	}
	for index, candidate := range candidates {
		item := candidateToDTO(candidate, query)
		result[index] = item
		catalog.byOwner[owner][candidateKey(item.Source, item.ID)] = item
	}
	catalog.mu.Unlock()
	return result, nil
}

func (catalog *candidateCatalog) get(
	owner string,
	sourceName string,
	candidateID string,
) (AlbumCandidate, bool) {
	catalog.mu.RLock()
	defer catalog.mu.RUnlock()
	candidate, exists := catalog.byOwner[owner][candidateKey(sourceName, candidateID)]
	return candidate, exists
}

func (catalog *candidateCatalog) discardOwner(owner string) {
	catalog.mu.Lock()
	delete(catalog.byOwner, owner)
	catalog.mu.Unlock()
}

func (catalog *candidateCatalog) clear() {
	catalog.mu.Lock()
	catalog.byOwner = make(map[string]map[string]AlbumCandidate)
	catalog.mu.Unlock()
}
