package bridge

func (service *desktopService) saveMetadataAs(directory string) (string, error) {
	dialog := service.app.Dialog.SaveFile().
		SetFilename("metadata.json").
		SetDirectory(directory).
		AddFilter("JSON (*.json)", "*.json").
		AllowsOtherFileTypes(false).
		AttachToWindow(service.window)
	path, err := dialog.PromptForSingleSelection()
	if err != nil && err.Error() == dialogCancelledError {
		return "", nil
	}
	return path, err
}
