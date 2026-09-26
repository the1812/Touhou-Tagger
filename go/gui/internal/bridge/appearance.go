package bridge

type AppearanceService struct {
	desktop *desktopService
}

func (service *AppearanceService) SetDarkMode(dark bool) error {
	service.desktop.mu.Lock()
	window := service.desktop.window
	service.desktop.mu.Unlock()
	return setTitleBarColor(window, dark)
}
