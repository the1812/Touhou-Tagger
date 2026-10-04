package bridge

import (
	"fmt"
	"os"
	"path/filepath"
)

func (service *desktopService) selectDirectories(title string) ([]string, error) {
	service.mu.Lock()
	initial := service.lastDirectories[batchDirectory]
	service.mu.Unlock()
	if !fileExists(initial) {
		initial = ""
	}
	selected, err := selectMultipleDirectories(service.app, service.window, title, initial)
	if err != nil {
		return nil, err
	}
	result := make([]string, 0, len(selected))
	for _, directory := range selected {
		absolute, err := filepath.Abs(directory)
		if err != nil {
			return nil, fmt.Errorf("解析目录路径: %w", err)
		}
		info, err := os.Stat(absolute)
		if err != nil {
			return nil, fmt.Errorf("检查所选目录 %q: %w", absolute, err)
		}
		if !info.IsDir() {
			return nil, fmt.Errorf("所选路径 %q 不是目录", absolute)
		}
		result = append(result, absolute)
	}
	if len(result) > 0 {
		service.mu.Lock()
		service.lastDirectories[batchDirectory] = filepath.Dir(result[0])
		service.mu.Unlock()
	}
	return result, nil
}
