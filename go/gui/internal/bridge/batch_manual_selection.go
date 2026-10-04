package bridge

import (
	"context"
	"fmt"
	"path/filepath"
	"slices"
)

func (service *BatchService) SelectMultipleDirectories(title string) ([]string, error) {
	return service.desktop.selectDirectories(title)
}

func (service *BatchService) CreateBatchFromDirectories(ctx context.Context, directories []string, source string) (BatchPreview, error) {
	paths, err := uniqueBatchDirectories(nil, directories)
	if err != nil {
		return BatchPreview{}, err
	}
	if source == "" {
		source = service.runtime.getConfig().Source
	}
	applicationService, err := service.runtime.service(nil)
	if err != nil {
		return BatchPreview{}, err
	}
	return service.createSession(applicationService.PrepareBatchEntries(ctx, paths), "", source), nil
}

func (service *BatchService) AddBatchDirectories(ctx context.Context, batchID string, directories []string) (BatchPreview, error) {
	service.mu.RLock()
	session := service.sessions[batchID]
	service.mu.RUnlock()
	paths, err := uniqueBatchDirectories(session.entries, directories)
	if err != nil {
		return BatchPreview{}, err
	}
	applicationService, err := service.runtime.service(nil)
	if err != nil {
		return BatchPreview{}, err
	}
	for _, scan := range applicationService.PrepareBatchEntries(ctx, paths) {
		session.entries = append(session.entries, newBatchEntry(scan, session.source, session.id, service.planner))
	}
	return session.preview(), nil
}

func (service *BatchService) RemoveBatchEntry(batchID, entryID string) BatchPreview {
	service.mu.RLock()
	session := service.sessions[batchID]
	service.mu.RUnlock()
	index := slices.IndexFunc(session.entries, func(entry *batchEntry) bool { return entry.id == entryID })
	session.entries[index].discardPlan()
	session.entries = slices.Delete(session.entries, index, index+1)
	return session.preview()
}

func uniqueBatchDirectories(entries []*batchEntry, directories []string) ([]string, error) {
	known := make([]string, 0, len(entries)+len(directories))
	for _, entry := range entries {
		known = append(known, entry.directory)
	}
	result := make([]string, 0, len(directories))
	for _, directory := range directories {
		absolute, err := filepath.Abs(directory)
		if err != nil {
			return nil, fmt.Errorf("解析目录 %q: %w", directory, err)
		}
		duplicate := false
		for _, existing := range known {
			if sameDirectory(existing, absolute) {
				duplicate = true
				break
			}
			if nestedDirectory(existing, absolute) || nestedDirectory(absolute, existing) {
				return nil, fmt.Errorf("不能同时选择父目录和子目录：%s、%s", existing, absolute)
			}
		}
		if !duplicate {
			known = append(known, absolute)
			result = append(result, absolute)
		}
	}
	return result, nil
}
