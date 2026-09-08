//go:build !windows

package bridge

func platformErrorCode(error) string { return "" }
