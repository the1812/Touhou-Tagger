package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const (
	defaultWindowWidth  = 1280
	defaultWindowHeight = 800
	minimumWindowWidth  = 960
	minimumWindowHeight = 640
)

type windowState struct {
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Maximised bool `json:"maximised"`
}

type windowStateTracker struct {
	mu    sync.Mutex
	state windowState
}

func loadWindowState() (windowState, error) {
	result := windowState{Width: defaultWindowWidth, Height: defaultWindowHeight}
	path, err := windowStatePath()
	if err != nil {
		return result, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, fmt.Errorf("read GUI state: %w", err)
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return windowState{Width: defaultWindowWidth, Height: defaultWindowHeight}, fmt.Errorf(
			"parse GUI state: %w",
			err,
		)
	}
	result.Width = max(result.Width, minimumWindowWidth)
	result.Height = max(result.Height, minimumWindowHeight)
	return result, nil
}

func newWindowStateTracker(state windowState, window *application.WebviewWindow) *windowStateTracker {
	tracker := &windowStateTracker{state: state}
	window.OnWindowEvent(events.Common.WindowDidResize, func(_ *application.WindowEvent) {
		if window.IsMaximised() || window.IsMinimised() {
			return
		}
		width, height := window.Size()
		if width < minimumWindowWidth || height < minimumWindowHeight {
			return
		}
		tracker.mu.Lock()
		tracker.state.Width = width
		tracker.state.Height = height
		tracker.mu.Unlock()
	})
	return tracker
}

func (tracker *windowStateTracker) save(window *application.WebviewWindow) (resultErr error) {
	tracker.mu.Lock()
	state := tracker.state
	tracker.mu.Unlock()
	state.Maximised = window.IsMaximised()
	if !state.Maximised && !window.IsMinimised() {
		width, height := window.Size()
		if width >= minimumWindowWidth && height >= minimumWindowHeight {
			state.Width = width
			state.Height = height
		}
	}
	path, err := windowStatePath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("encode GUI state: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create GUI state directory: %w", err)
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".gui-state-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary GUI state: %w", err)
	}
	temporaryPath := temporary.Name()
	closed := false
	defer func() {
		if !closed {
			resultErr = errors.Join(resultErr, temporary.Close())
		}
		if err := os.Remove(temporaryPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary GUI state: %w", err))
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("set GUI state permissions: %w", err)
	}
	if _, err := temporary.Write(data); err != nil {
		return fmt.Errorf("write GUI state: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("flush GUI state: %w", err)
	}
	if err := temporary.Close(); err != nil {
		closed = true
		return fmt.Errorf("close GUI state: %w", err)
	}
	closed = true
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("replace GUI state: %w", err)
	}
	return nil
}

func windowStatePath() (string, error) {
	metadataConfigPath, err := config.Path()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(metadataConfigPath), "gui.json"), nil
}
