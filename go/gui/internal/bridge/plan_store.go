package bridge

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type fileSnapshot struct {
	Path             string
	Exists           bool
	Size             int64
	ModifiedUnixNano int64
	Digest           [32]byte
	HasDigest        bool
}

type outputSnapshot struct {
	Kind   string
	ItemID string
	File   fileSnapshot
}

type planSnapshot struct {
	AudioFiles  []fileSnapshot
	LocalCover  fileSnapshot
	Metadata    fileSnapshot
	AlbumConfig fileSnapshot
	Outputs     []outputSnapshot
}

type planSession struct {
	mu          sync.Mutex
	id          string
	owner       string
	revision    int
	scan        domain.AlbumScan
	metadata    []domain.Metadata
	plan        domain.TagPlan
	candidate   domain.AlbumCandidate
	cover       []byte
	coverSource string
	saveCover   bool
	config      domain.MetadataConfig
	snapshot    planSnapshot
	issues      []StateIssue
	committing  bool
}

type planStore struct {
	mu       sync.RWMutex
	sessions map[string]*planSession
}

func newPlanStore() *planStore {
	return &planStore{sessions: make(map[string]*planSession)}
}

func (store *planStore) put(session *planSession) {
	store.mu.Lock()
	for id, existing := range store.sessions {
		existing.mu.Lock()
		sameOwner := existing.owner == session.owner
		sameDirectory := equalPath(existing.scan.Directory, session.scan.Directory)
		committing := existing.committing
		existing.mu.Unlock()
		replaceWorkspace := session.owner == "workspace" && sameOwner
		replaceBatchJob := session.owner != "workspace" && sameOwner && sameDirectory
		if (replaceWorkspace || replaceBatchJob) && !committing {
			delete(store.sessions, id)
		}
	}
	store.sessions[session.id] = session
	store.mu.Unlock()
}

func (store *planStore) get(id string) (*planSession, bool) {
	store.mu.RLock()
	session, exists := store.sessions[id]
	store.mu.RUnlock()
	return session, exists
}

func (store *planStore) delete(id string) {
	store.mu.Lock()
	delete(store.sessions, id)
	store.mu.Unlock()
}

func (store *planStore) discard(id string) bool {
	store.mu.Lock()
	defer store.mu.Unlock()
	session, exists := store.sessions[id]
	if !exists {
		return false
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.committing {
		return false
	}
	delete(store.sessions, id)
	return true
}

func (store *planStore) discardOwner(owner string) {
	store.mu.Lock()
	for id, session := range store.sessions {
		session.mu.Lock()
		matches := session.owner == owner
		committing := session.committing
		session.mu.Unlock()
		if matches && !committing {
			delete(store.sessions, id)
		}
	}
	store.mu.Unlock()
}

func (store *planStore) clear() {
	store.mu.Lock()
	store.sessions = make(map[string]*planSession)
	store.mu.Unlock()
}

func newID(prefix string) string {
	var value [12]byte
	if _, err := rand.Read(value[:]); err != nil {
		panic(fmt.Sprintf("generate %s id: %v", prefix, err))
	}
	return prefix + "-" + hex.EncodeToString(value[:])
}
