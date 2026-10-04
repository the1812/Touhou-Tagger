package bridge

type batchSession struct {
	id      string
	root    string
	source  string
	entries []*batchEntry
}

func (session *batchSession) preview() BatchPreview {
	return BatchPreview{
		BatchID: session.id,
		Entries: session.entryPreviews(),
	}
}

func (session *batchSession) entryPreviews() []BatchEntryPreview {
	result := make([]BatchEntryPreview, len(session.entries))
	for index, entry := range session.entries {
		result[index] = entry.preview(session.root)
	}
	return result
}

func (session *batchSession) selectEntries(failedOnly bool) []*batchEntry {
	selected := make([]*batchEntry, 0, len(session.entries))
	for _, entry := range session.entries {
		if entry.queue(failedOnly) {
			selected = append(selected, entry)
		}
	}
	return selected
}

func (session *batchSession) cancelRemaining(entries []*batchEntry) {
	for _, entry := range entries {
		entry.cancel()
	}
}

func (session *batchSession) findEntry(id string) *batchEntry {
	for _, entry := range session.entries {
		if entry.id == id {
			return entry
		}
	}
	return nil
}
