package bridge

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	wails "github.com/wailsapp/wails/v3/pkg/application"
)

type directoryKind string

const (
	albumDirectory       directoryKind = "album"
	batchDirectory       directoryKind = "batch"
	dialogCancelledError               = "cancelled by user"
)

type desktopService struct {
	mu              sync.Mutex
	app             *wails.App
	window          *wails.WebviewWindow
	lastDirectories map[directoryKind]string
}

func newDesktopService() *desktopService {
	return &desktopService{lastDirectories: make(map[directoryKind]string)}
}

func (service *desktopService) attach(app *wails.App, window *wails.WebviewWindow) {
	service.mu.Lock()
	service.app = app
	service.window = window
	service.mu.Unlock()
}

func (service *desktopService) selectDirectory(title string, kind directoryKind) (string, error) {
	service.mu.Lock()
	app := service.app
	window := service.window
	initial := service.lastDirectories[kind]
	service.mu.Unlock()
	if app == nil {
		return "", fmt.Errorf("原生目录对话框尚未初始化")
	}
	dialog := app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle(title)
	if initial != "" && fileExists(initial) {
		dialog.SetDirectory(initial)
	}
	if window != nil {
		dialog.AttachToWindow(window)
	}
	selected, err := dialog.PromptForSingleSelection()
	if err != nil {
		if err.Error() == dialogCancelledError {
			return "", nil
		}
		return "", err
	}
	if selected == "" {
		return "", nil
	}
	absolute, err := filepath.Abs(selected)
	if err != nil {
		return "", fmt.Errorf("解析目录路径: %w", err)
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return "", fmt.Errorf("检查所选目录 %q: %w", absolute, err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("所选路径 %q 不是目录", absolute)
	}
	service.mu.Lock()
	service.lastDirectories[kind] = absolute
	service.mu.Unlock()
	return absolute, nil
}

func (service *desktopService) revealDirectory(ctx context.Context, directory string) error {
	info, err := os.Stat(directory)
	if err != nil {
		return fmt.Errorf("打开目录 %q: %w", directory, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%q 不是目录", directory)
	}
	command := exec.CommandContext(ctx, "explorer.exe", directory)
	if err := command.Start(); err != nil {
		return fmt.Errorf("打开资源管理器: %w", err)
	}
	if err := command.Process.Release(); err != nil {
		return fmt.Errorf("释放资源管理器进程句柄: %w", err)
	}
	return nil
}
