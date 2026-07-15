package imagecodec

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/tetratelabs/wazero/api"
)

const resizeFlags = 1<<0 | 1<<1 | 1<<2

type resizeInstance struct {
	*wasmModule
	resize api.Function
}

func newResizeInstance(ctx context.Context, module api.Module) (*resizeInstance, error) {
	wasm, err := newWasmModule(ctx, module, "resize.wasm")
	if err != nil {
		return nil, err
	}
	resize := module.ExportedFunction("resize")
	if resize == nil {
		return nil, errors.New("resize.wasm does not export resize")
	}
	return &resizeInstance{wasmModule: wasm, resize: resize}, nil
}

func (r *resizeInstance) run(
	ctx context.Context,
	input []byte,
	inputWidth, inputHeight, outputWidth, outputHeight int,
) ([]byte, error, bool) {
	outputLength, err := rgbaByteLength(outputWidth, outputHeight)
	if err != nil {
		return nil, err, false
	}
	inputPointer, err, broken := r.write(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("prepare resize input: %w", err), broken
	}
	outputPointer, err, allocationBroken := r.allocate(ctx, outputLength)
	broken = broken || allocationBroken
	if err != nil {
		freeErr, freeBroken := r.release(ctx, inputPointer)
		return nil, errors.Join(fmt.Errorf("prepare resize output: %w", err), freeErr), broken || freeBroken
	}

	if cause := context.Cause(ctx); cause != nil {
		err = fmt.Errorf("execute resize.wasm: %w", cause)
	} else {
		result, callErr := r.resize.Call(
			ctx,
			uint64(inputPointer),
			uint64(inputWidth),
			uint64(inputHeight),
			uint64(outputPointer),
			uint64(outputWidth),
			uint64(outputHeight),
			resizeFlags,
		)
		if callErr != nil {
			broken = true
			err = fmt.Errorf("execute resize.wasm: %w", callErr)
		} else if cause = context.Cause(ctx); cause != nil {
			err = fmt.Errorf("execute resize.wasm: %w", cause)
		} else if len(result) != 1 || result[0] != 0 {
			err = fmt.Errorf("execute resize.wasm: status %v", result)
		}
	}

	var output []byte
	if err == nil {
		view, ok := r.memory.Read(outputPointer, outputLength)
		if !ok {
			err = errors.New("read resize output outside WASM memory")
			broken = true
		} else {
			output = append([]byte(nil), view...)
		}
	}
	inputFreeErr, inputFreeBroken := r.release(ctx, inputPointer)
	outputFreeErr, outputFreeBroken := r.release(ctx, outputPointer)
	return output, errors.Join(err, inputFreeErr, outputFreeErr), broken || inputFreeBroken || outputFreeBroken
}

func rgbaByteLength(width, height int) (uint32, error) {
	if width <= 0 || height <= 0 {
		return 0, fmt.Errorf("invalid RGBA dimensions: %dx%d", width, height)
	}
	length := uint64(width) * uint64(height) * 4
	if length > math.MaxUint32 {
		return 0, fmt.Errorf("RGBA image exceeds WASM32 memory: %dx%d", width, height)
	}
	return uint32(length), nil
}
