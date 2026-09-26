package bridge

import (
	"errors"
	"fmt"
	"syscall"
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

var setWindowAttribute = syscall.NewLazyDLL("dwmapi.dll").NewProc("DwmSetWindowAttribute")

func setTitleBarColor(window *wails.WebviewWindow, dark bool) error {
	if !w32.IsWindowsVersionAtLeast(10, 0, 22000) {
		return nil
	}
	if window == nil {
		return fmt.Errorf("窗口尚未初始化")
	}
	return wails.InvokeSyncWithError(func() error {
		hwnd := uintptr(window.NativeWindow())
		if hwnd == 0 {
			return fmt.Errorf("窗口句柄不可用")
		}
		if err := setWindowAttribute.Find(); err != nil {
			return fmt.Errorf("查找 DwmSetWindowAttribute: %w", err)
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

func setDWMColor(hwnd uintptr, attribute uintptr, color uint32) error {
	result, _, _ := setWindowAttribute.Call(hwnd, attribute, uintptr(unsafe.Pointer(&color)), unsafe.Sizeof(color))
	if int32(result) < 0 {
		return fmt.Errorf("设置窗口标题栏属性 %d: HRESULT 0x%08x", attribute, uint32(result))
	}
	return nil
}
