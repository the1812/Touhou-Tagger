//go:build !windows

package bridge

import wails "github.com/wailsapp/wails/v3/pkg/application"

func setTitleBarColor(_ *wails.WebviewWindow, _ bool) error {
	return nil
}
