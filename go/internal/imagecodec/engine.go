package imagecodec

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"sync"
	"sync/atomic"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	defaultPoolSize = 1
	wasmABIVersion  = 1
)

var ErrClosed = errors.New("image codec engine is closed")

type Options struct {
	PoolSize int
}

type Engine struct {
	runtime         wazero.Runtime
	resizeCompiled  wazero.CompiledModule
	mozjpegCompiled wazero.CompiledModule
	pool            chan poolSlot
	done            chan struct{}
	closed          atomic.Bool
	cacheMu         sync.Mutex
	cache           coverCache
}

type coverCache struct {
	digest       [sha256.Size]byte
	maxDimension int
	output       []byte
	valid        bool
}

type poolSlot struct {
	instance *pipelineInstance
	err      error
}

func New(ctx context.Context, options Options) (*Engine, error) {
	poolSize := options.PoolSize
	if poolSize == 0 {
		poolSize = defaultPoolSize
	}
	if poolSize < 1 {
		return nil, fmt.Errorf("image codec pool size must be positive: %d", poolSize)
	}

	runtimeConfig := wazero.NewRuntimeConfigCompiler()
	wasmRuntime := wazero.NewRuntimeWithConfig(ctx, runtimeConfig)
	engine := &Engine{
		runtime: wasmRuntime,
		pool:    make(chan poolSlot, poolSize),
		done:    make(chan struct{}),
	}

	if err := engine.initialize(ctx, poolSize); err != nil {
		closeErr := wasmRuntime.Close(ctx)
		return nil, errors.Join(err, closeErr)
	}
	return engine, nil
}

func (e *Engine) initialize(ctx context.Context, poolSize int) error {
	if _, err := wasi_snapshot_preview1.Instantiate(ctx, e.runtime); err != nil {
		return fmt.Errorf("instantiate WASI host module: %w", err)
	}
	if _, err := e.runtime.NewHostModuleBuilder("env").
		NewFunctionBuilder().
		WithFunc(func(context.Context, uint32) {}).
		Export("emscripten_notify_memory_growth").
		Instantiate(ctx); err != nil {
		return fmt.Errorf("instantiate Emscripten memory-growth host module: %w", err)
	}

	var err error
	e.resizeCompiled, err = e.runtime.CompileModule(ctx, resizeWASM)
	if err != nil {
		return fmt.Errorf("compile resize.wasm: %w", err)
	}
	e.mozjpegCompiled, err = e.runtime.CompileModule(ctx, mozjpegWASM)
	if err != nil {
		return fmt.Errorf("compile mozjpeg.wasm: %w", err)
	}

	for range poolSize {
		instance, instantiateErr := e.instantiatePipeline(ctx)
		if instantiateErr != nil {
			return instantiateErr
		}
		e.pool <- poolSlot{instance: instance}
	}
	return nil
}

func (e *Engine) Compress(
	ctx context.Context,
	data []byte,
	options domain.CoverOptions,
) ([]byte, error) {
	if err := context.Cause(ctx); err != nil {
		return nil, fmt.Errorf("compress cover: %w", err)
	}
	if len(data) == 0 {
		return nil, errors.New("decode cover: image data is empty")
	}
	if options.MaxDimension < 0 {
		return nil, fmt.Errorf("cover maximum dimension must not be negative: %d", options.MaxDimension)
	}
	digest := sha256.Sum256(data)
	if output, ok := e.cachedCover(digest, options.MaxDimension); ok {
		return output, nil
	}

	slot, err := e.acquire(ctx)
	if err != nil {
		return nil, err
	}
	if output, ok := e.cachedCover(digest, options.MaxDimension); ok {
		if err := e.release(ctx, slot.instance, false); err != nil {
			return nil, err
		}
		return output, nil
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		releaseErr := e.release(ctx, slot.instance, false)
		return nil, errors.Join(fmt.Errorf("decode cover: %w", err), releaseErr)
	}
	rgba := toStraightRGBA(decoded)
	inputWidth := rgba.Bounds().Dx()
	inputHeight := rgba.Bounds().Dy()
	outputWidth, outputHeight := targetDimensions(inputWidth, inputHeight, options.MaxDimension)

	output, runErr, broken := slot.instance.compress(
		ctx,
		rgba.Pix,
		inputWidth,
		inputHeight,
		outputWidth,
		outputHeight,
		qualityForSize(len(data)),
	)
	releaseErr := e.release(ctx, slot.instance, broken)
	if err = errors.Join(runErr, releaseErr); err != nil {
		return nil, err
	}
	e.storeCover(digest, options.MaxDimension, output)
	return output, nil
}

func (e *Engine) cachedCover(digest [sha256.Size]byte, maxDimension int) ([]byte, bool) {
	e.cacheMu.Lock()
	defer e.cacheMu.Unlock()
	if !e.cache.valid || e.cache.digest != digest || e.cache.maxDimension != maxDimension {
		return nil, false
	}
	return append([]byte(nil), e.cache.output...), true
}

func (e *Engine) storeCover(digest [sha256.Size]byte, maxDimension int, output []byte) {
	e.cacheMu.Lock()
	e.cache = coverCache{
		digest: digest, maxDimension: maxDimension,
		output: append([]byte(nil), output...), valid: true,
	}
	e.cacheMu.Unlock()
}

func (e *Engine) Close(ctx context.Context) error {
	if !e.closed.CompareAndSwap(false, true) {
		return nil
	}
	close(e.done)
	e.cacheMu.Lock()
	e.cache = coverCache{}
	e.cacheMu.Unlock()

	var closeErrors []error
	if e.resizeCompiled != nil {
		closeErrors = append(closeErrors, e.resizeCompiled.Close(ctx))
	}
	if e.mozjpegCompiled != nil {
		closeErrors = append(closeErrors, e.mozjpegCompiled.Close(ctx))
	}
	closeErrors = append(closeErrors, e.runtime.Close(ctx))
	return errors.Join(closeErrors...)
}

func (e *Engine) acquire(ctx context.Context) (poolSlot, error) {
	if e.closed.Load() {
		return poolSlot{}, ErrClosed
	}
	select {
	case <-e.done:
		return poolSlot{}, ErrClosed
	case <-ctx.Done():
		return poolSlot{}, fmt.Errorf("acquire image codec instance: %w", context.Cause(ctx))
	case slot := <-e.pool:
		if slot.err != nil {
			e.pool <- slot
			return poolSlot{}, slot.err
		}
		return slot, nil
	}
}

func (e *Engine) release(ctx context.Context, instance *pipelineInstance, broken bool) error {
	cleanupCtx := context.WithoutCancel(ctx)
	if broken {
		closeErr := instance.close(cleanupCtx)
		if e.closed.Load() {
			return closeErr
		}
		replacement, err := e.instantiatePipeline(cleanupCtx)
		if err != nil {
			wrapped := fmt.Errorf("replace failed image codec instance: %w", err)
			e.pool <- poolSlot{err: wrapped}
			return errors.Join(closeErr, wrapped)
		}
		instance = replacement
	}

	select {
	case <-e.done:
		return instance.close(cleanupCtx)
	case e.pool <- poolSlot{instance: instance}:
		return nil
	}
}

func toStraightRGBA(source image.Image) *image.NRGBA {
	bounds := source.Bounds()
	output := image.NewNRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(output, output.Bounds(), source, bounds.Min, draw.Src)
	return output
}

func targetDimensions(width, height, maxDimension int) (int, int) {
	if maxDimension == 0 || (width <= maxDimension && height <= maxDimension) {
		return width, height
	}
	if width >= height {
		return maxDimension, max(1, int(math.Round(float64(height)*float64(maxDimension)/float64(width))))
	}
	return max(1, int(math.Round(float64(width)*float64(maxDimension)/float64(height)))), maxDimension
}

func qualityForSize(size int) int {
	quality := int(math.Round(92.647 - 1.683e-6*float64(size)))
	return min(100, max(0, quality))
}
