package bridge

import (
	"errors"
	"fmt"
	"unsafe"

	wails "github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/w32"
)

const (
	captionColorAttribute = 35
	textColorAttribute    = 36
	lightCaptionColor     = 0x00ffffff
	darkCaptionColor      = 0x001a1315
	defaultCaptionColor   = 0xffffffff
)

func setTitleBarColor(window *wails.WebviewWindow, dark bool) error {
	if !w32.IsWindowsVersionAtLeast(10, 0, 22000) {
		return nil
	}
	return wails.InvokeSyncWithError(func() error {
		hwnd := uintptr(window.NativeWindow())
		if hwnd == 0 {
			return fmt.Errorf("窗口句柄不可用")
		}
		caption := uint32(lightCaptionColor)
		text := uint32(0x00000000)
		if dark {
			caption = darkCaptionColor
			text = lightCaptionColor
		}
		if err := setDWMColor(hwnd, captionColorAttribute, caption); err != nil {
			return err
		}
		if err := setDWMColor(hwnd, textColorAttribute, text); err != nil {
			return errors.Join(err, setDWMColor(hwnd, captionColorAttribute, defaultCaptionColor))
		}
		w32.SetTheme(hwnd, dark)
		return nil
	})
}

func setDWMColor(hwnd uintptr, attribute w32.DWMWINDOWATTRIBUTE, color uint32) error {
	result := w32.DwmSetWindowAttribute(hwnd, attribute, unsafe.Pointer(&color), unsafe.Sizeof(color))
	if result < 0 {
		return fmt.Errorf("设置窗口标题栏属性 %d: HRESULT 0x%08x", attribute, uint32(result))
	}
	return nil
}
