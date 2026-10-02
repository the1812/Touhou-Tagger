package imagecodec

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"math"

	extism "github.com/extism/go-sdk"
)

func callCodec(
	ctx context.Context,
	plugin *extism.Plugin,
	function string,
	rgba []byte,
	inputWidth, inputHeight, outputWidth, outputHeight, quality int,
) ([]byte, error, bool) {
	if err := context.Cause(ctx); err != nil {
		return nil, err, false
	}
	const headerSize = 5 * 4
	if uint64(len(rgba)) > math.MaxUint32-headerSize {
		return nil, errors.New("image data exceeds WASM32 memory"), false
	}
	input := make([]byte, headerSize+len(rgba))
	for index, value := range []int{inputWidth, inputHeight, outputWidth, outputHeight, quality} {
		if value < 0 || uint64(value) > math.MaxUint32 {
			return nil, fmt.Errorf("image parameter exceeds WASM32 range: %d", value), false
		}
		binary.LittleEndian.PutUint32(input[index*4:], uint32(value))
	}
	copy(input[headerSize:], rgba)
	exit, output, err := plugin.CallWithContext(ctx, function, input)
	if err = errors.Join(err, context.Cause(ctx)); err != nil {
		return nil, fmt.Errorf("execute imagecodec.wasm %s: %w", function, err), true
	}
	if exit != 0 {
		return nil, fmt.Errorf("execute imagecodec.wasm %s: status %d", function, exit), true
	}
	return output, nil, false
}
