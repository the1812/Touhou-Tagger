package imagecodec

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
)

type pipelineInstance struct {
	resize  *resizeInstance
	mozjpeg *mozjpegInstance
}

type wasmModule struct {
	module api.Module
	memory api.Memory
	alloc  api.Function
	free   api.Function
}

func (e *Engine) instantiatePipeline(ctx context.Context) (*pipelineInstance, error) {
	resizeModule, err := e.runtime.InstantiateModule(
		ctx,
		e.resizeCompiled,
		wazero.NewModuleConfig().WithName(""),
	)
	if err != nil {
		return nil, fmt.Errorf("instantiate resize.wasm: %w", err)
	}
	resize, err := newResizeInstance(ctx, resizeModule)
	if err != nil {
		closeErr := resizeModule.Close(ctx)
		return nil, errors.Join(err, closeErr)
	}

	mozjpegModule, err := e.runtime.InstantiateModule(
		ctx,
		e.mozjpegCompiled,
		wazero.NewModuleConfig().WithName(""),
	)
	if err != nil {
		closeErr := resize.module.Close(ctx)
		return nil, errors.Join(fmt.Errorf("instantiate mozjpeg.wasm: %w", err), closeErr)
	}
	mozjpeg, err := newMozjpegInstance(ctx, mozjpegModule)
	if err != nil {
		closeErr := errors.Join(resize.module.Close(ctx), mozjpegModule.Close(ctx))
		return nil, errors.Join(err, closeErr)
	}

	return &pipelineInstance{resize: resize, mozjpeg: mozjpeg}, nil
}

func newWasmModule(ctx context.Context, module api.Module, name string) (*wasmModule, error) {
	if initialize := module.ExportedFunction("_initialize"); initialize != nil {
		if _, err := initialize.Call(ctx); err != nil {
			return nil, fmt.Errorf("initialize %s: %w", name, err)
		}
	}

	version := module.ExportedFunction("abi_version")
	alloc := module.ExportedFunction("alloc")
	free := module.ExportedFunction("free")
	memory := module.ExportedMemory("memory")
	if version == nil || alloc == nil || free == nil || memory == nil {
		return nil, fmt.Errorf("%s does not export the required stable ABI", name)
	}
	result, err := version.Call(ctx)
	if err != nil {
		return nil, fmt.Errorf("read %s ABI version: %w", name, err)
	}
	if len(result) != 1 || uint32(result[0]) != wasmABIVersion {
		return nil, fmt.Errorf("%s ABI version mismatch: expected %d, got %v", name, wasmABIVersion, result)
	}
	return &wasmModule{module: module, memory: memory, alloc: alloc, free: free}, nil
}

func (m *wasmModule) write(ctx context.Context, data []byte) (uint32, error, bool) {
	if len(data) > math.MaxUint32 {
		return 0, fmt.Errorf("image data exceeds WASM32 memory: %d bytes", len(data)), false
	}
	result, err := m.alloc.Call(ctx, uint64(len(data)))
	if err != nil {
		return 0, fmt.Errorf("allocate %d bytes in WASM memory: %w", len(data), err), true
	}
	if len(result) != 1 || result[0] == 0 {
		return 0, fmt.Errorf("allocate %d bytes in WASM memory: allocator returned null", len(data)), false
	}
	pointer := uint32(result[0])
	if !m.memory.Write(pointer, data) {
		freeErr, _ := m.release(ctx, pointer)
		return 0, errors.Join(errors.New("write image data outside WASM memory"), freeErr), true
	}
	return pointer, nil, false
}

func (m *wasmModule) allocate(ctx context.Context, size uint32) (uint32, error, bool) {
	result, err := m.alloc.Call(ctx, uint64(size))
	if err != nil {
		return 0, fmt.Errorf("allocate %d bytes in WASM memory: %w", size, err), true
	}
	if len(result) != 1 || result[0] == 0 {
		return 0, fmt.Errorf("allocate %d bytes in WASM memory: allocator returned null", size), false
	}
	return uint32(result[0]), nil, false
}

func (m *wasmModule) release(ctx context.Context, pointer uint32) (error, bool) {
	if pointer == 0 {
		return nil, false
	}
	if _, err := m.free.Call(context.WithoutCancel(ctx), uint64(pointer)); err != nil {
		return fmt.Errorf("free WASM memory at %#x: %w", pointer, err), true
	}
	return nil, false
}

func (p *pipelineInstance) compress(
	ctx context.Context,
	rgba []byte,
	inputWidth, inputHeight, outputWidth, outputHeight, quality int,
) ([]byte, error, bool) {
	resized := rgba
	if inputWidth != outputWidth || inputHeight != outputHeight {
		var err error
		var broken bool
		resized, err, broken = p.resize.run(
			ctx,
			rgba,
			inputWidth,
			inputHeight,
			outputWidth,
			outputHeight,
		)
		if err != nil {
			return nil, err, broken
		}
	}
	return p.mozjpeg.run(ctx, resized, outputWidth, outputHeight, quality)
}

func (p *pipelineInstance) close(ctx context.Context) error {
	return errors.Join(p.resize.module.Close(ctx), p.mozjpeg.module.Close(ctx))
}
