package bridge

import (
	"errors"

	"github.com/ncruces/zenity"
	wails "github.com/wailsapp/wails/v3/pkg/application"
)

func selectMultipleDirectories(_ *wails.App, window *wails.WebviewWindow, title, initial string) ([]string, error) {
	return wails.InvokeSyncWithResultAndError(func() ([]string, error) {
		paths, err := zenity.SelectFileMultiple(
			zenity.Directory(),
			zenity.Title(title),
			zenity.Filename(initial),
			zenity.Attach(uintptr(window.NativeWindow())),
		)
		if errors.Is(err, zenity.ErrCanceled) {
			return []string{}, nil
		}
		return paths, err
	})
}
