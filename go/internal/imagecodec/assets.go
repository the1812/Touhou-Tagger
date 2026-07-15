package imagecodec

import _ "embed"

//go:embed assets/resize.wasm
var resizeWASM []byte

//go:embed assets/mozjpeg.wasm
var mozjpegWASM []byte
