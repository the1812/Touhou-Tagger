//go:build !windows

package bridge

import wails "github.com/wailsapp/wails/v3/pkg/application"

func selectMultipleDirectories(app *wails.App, window *wails.WebviewWindow, title, initial string) ([]string, error) {
	dialog := app.Dialog.OpenFile().CanChooseDirectories(true).CanChooseFiles(false).SetTitle(title).AttachToWindow(window)
	if initial != "" {
		dialog.SetDirectory(initial)
	}
	paths, err := dialog.PromptForMultipleSelection()
	if err != nil && err.Error() == dialogCancelledError {
		return []string{}, nil
	}
	return paths, err
}
