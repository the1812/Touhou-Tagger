package imagecodec

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/tetratelabs/wazero/api"
)

const outputDescriptorSize = 8

type mozjpegInstance struct {
	*wasmModule
	encode api.Function
}

func newMozjpegInstance(ctx context.Context, module api.Module) (*mozjpegInstance, error) {
	wasm, err := newWasmModule(ctx, module, "mozjpeg.wasm")
	if err != nil {
		return nil, err
	}
	encode := module.ExportedFunction("mozjpeg_encode")
	if encode == nil {
		return nil, errors.New("mozjpeg.wasm does not export mozjpeg_encode")
	}
	return &mozjpegInstance{wasmModule: wasm, encode: encode}, nil
}

func (m *mozjpegInstance) run(
	ctx context.Context,
	rgba []byte,
	width, height, quality int,
) ([]byte, error, bool) {
	inputPointer, err, broken := m.write(ctx, rgba)
	if err != nil {
		return nil, fmt.Errorf("prepare MozJPEG input: %w", err), broken
	}
	descriptorPointer, err, allocationBroken := m.allocate(ctx, outputDescriptorSize)
	broken = broken || allocationBroken
	if err != nil {
		freeErr, freeBroken := m.release(ctx, inputPointer)
		return nil, errors.Join(fmt.Errorf("prepare MozJPEG output: %w", err), freeErr), broken || freeBroken
	}

	encoded := false
	if cause := context.Cause(ctx); cause != nil {
		err = fmt.Errorf("execute mozjpeg.wasm: %w", cause)
	} else {
		result, callErr := m.encode.Call(
			ctx,
			uint64(inputPointer),
			uint64(width),
			uint64(height),
			uint64(quality),
			uint64(descriptorPointer),
		)
		if callErr != nil {
			broken = true
			err = fmt.Errorf("execute mozjpeg.wasm: %w", callErr)
		} else if len(result) != 1 || result[0] != 0 {
			err = fmt.Errorf("execute mozjpeg.wasm: status %v", result)
		} else {
			encoded = true
			if cause = context.Cause(ctx); cause != nil {
				err = fmt.Errorf("execute mozjpeg.wasm: %w", cause)
			}
		}
	}

	var output []byte
	var outputPointer uint32
	if encoded {
		descriptor, ok := m.memory.Read(descriptorPointer, outputDescriptorSize)
		if !ok {
			err = errors.Join(err, errors.New("read MozJPEG output descriptor outside WASM memory"))
			broken = true
		} else {
			outputPointer = binary.LittleEndian.Uint32(descriptor[0:4])
			outputLength := binary.LittleEndian.Uint32(descriptor[4:8])
			view, readOK := m.memory.Read(outputPointer, outputLength)
			if outputPointer == 0 || outputLength == 0 || !readOK {
				err = errors.Join(err, errors.New("read MozJPEG output outside WASM memory"))
				broken = true
			} else if err == nil {
				output = append([]byte(nil), view...)
			}
		}
	}

	inputFreeErr, inputFreeBroken := m.release(ctx, inputPointer)
	descriptorFreeErr, descriptorFreeBroken := m.release(ctx, descriptorPointer)
	outputFreeErr, outputFreeBroken := m.release(ctx, outputPointer)
	return output, errors.Join(err, inputFreeErr, descriptorFreeErr, outputFreeErr),
		broken || inputFreeBroken || descriptorFreeBroken || outputFreeBroken
}
