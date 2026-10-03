package bridge

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
)

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
		if session.replaces(existing) {
			delete(store.sessions, id)
		}
	}
	store.sessions[session.id] = session
	store.mu.Unlock()
}

func (store *planStore) get(id string) *planSession {
	store.mu.RLock()
	session := store.sessions[id]
	store.mu.RUnlock()
	return session
}

func (store *planStore) discard(id string) bool {
	store.mu.Lock()
	defer store.mu.Unlock()
	_, exists := store.sessions[id]
	if !exists {
		return false
	}
	delete(store.sessions, id)
	return true
}

func (store *planStore) discardOwner(owner string) {
	store.mu.Lock()
	for id, session := range store.sessions {
		if session.owner == owner {
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
