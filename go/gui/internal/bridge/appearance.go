package bridge

type AppearanceService struct {
	desktop *desktopService
}

func (service *AppearanceService) SetDarkMode(dark bool) error {
	return service.desktop.setDarkMode(dark)
}
