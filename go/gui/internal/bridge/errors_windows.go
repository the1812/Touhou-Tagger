package bridge

import (
	"errors"

	"golang.org/x/sys/windows"
)

func platformErrorCode(err error) string {
	switch {
	case errors.Is(err, windows.ERROR_SHARING_VIOLATION), errors.Is(err, windows.ERROR_LOCK_VIOLATION):
		return "fileBusy"
	case errors.Is(err, windows.ERROR_DISK_FULL), errors.Is(err, windows.ERROR_HANDLE_DISK_FULL):
		return "diskFull"
	}
	return ""
}
