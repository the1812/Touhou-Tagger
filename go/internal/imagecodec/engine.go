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

	extism "github.com/extism/go-sdk"
	"github.com/tetratelabs/wazero"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const defaultPoolSize = 1

var ErrClosed = errors.New("image codec engine is closed")

type Options struct {
	PoolSize int
}

type Engine struct {
	initMu   sync.Mutex
	compiled *extism.CompiledPlugin
	pool     chan poolSlot
	done     chan struct{}
	closed   atomic.Bool
	cacheMu  sync.Mutex
	cache    coverCache
}

type coverCache struct {
	digest       [sha256.Size]byte
	maxDimension int
	output       []byte
	valid        bool
}

type poolSlot struct {
	instance *extism.Plugin
	err      error
}

func New(ctx context.Context, options Options) (*Engine, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	poolSize := options.PoolSize
	if poolSize == 0 {
		poolSize = defaultPoolSize
	}
	if poolSize < 1 {
		return nil, fmt.Errorf("image codec pool size must be positive: %d", poolSize)
	}

	return &Engine{pool: make(chan poolSlot, poolSize), done: make(chan struct{})}, nil
}

func (e *Engine) ensureInitialized(ctx context.Context) error {
	e.initMu.Lock()
	defer e.initMu.Unlock()
	if e.closed.Load() {
		return ErrClosed
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if e.compiled != nil {
		return nil
	}
	if err := e.initialize(ctx, cap(e.pool)); err != nil {
		var closeErr error
		if e.compiled != nil {
			closeErr = e.compiled.Close(context.WithoutCancel(ctx))
		}
		e.compiled = nil
		for len(e.pool) > 0 {
			<-e.pool
		}
		return errors.Join(err, closeErr)
	}
	return nil
}

func (e *Engine) initialize(ctx context.Context, poolSize int) error {
	var err error
	e.compiled, err = extism.NewCompiledPlugin(ctx,
		extism.Manifest{Wasm: []extism.Wasm{extism.WasmData{Data: imagecodecWASM}}},
		extism.PluginConfig{
			EnableWasi:    true,
			RuntimeConfig: wazero.NewRuntimeConfigCompiler().WithCloseOnContextDone(true),
		}, nil)
	if err != nil {
		return fmt.Errorf("compile imagecodec.wasm: %w", err)
	}
	for range poolSize {
		instance, err := e.compiled.Instance(ctx, extism.PluginInstanceConfig{})
		if err != nil {
			return fmt.Errorf("instantiate imagecodec.wasm: %w", err)
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
	if e.closed.Load() {
		return nil, ErrClosed
	}
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

	output, runErr, broken := callCodec(
		ctx,
		slot.instance,
		"compress",
		rgba.Pix,
		inputWidth,
		inputHeight,
		outputWidth,
		outputHeight,
		qualityForSize(len(data)),
	)
	if runErr == nil {
		e.storeCover(digest, options.MaxDimension, output)
	}
	releaseErr := e.release(ctx, slot.instance, broken)
	if err = errors.Join(runErr, releaseErr); err != nil {
		return nil, err
	}
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
	defer e.cacheMu.Unlock()
	if e.closed.Load() {
		return
	}
	e.cache = coverCache{
		digest: digest, maxDimension: maxDimension,
		output: append([]byte(nil), output...), valid: true,
	}
}

func (e *Engine) Close(ctx context.Context) error {
	if !e.closed.CompareAndSwap(false, true) {
		return nil
	}
	close(e.done)
	e.initMu.Lock()
	defer e.initMu.Unlock()
	e.cacheMu.Lock()
	e.cache = coverCache{}
	e.cacheMu.Unlock()

	if e.compiled != nil {
		return e.compiled.Close(ctx)
	}
	return nil
}

func (e *Engine) acquire(ctx context.Context) (poolSlot, error) {
	if err := e.ensureInitialized(ctx); err != nil {
		return poolSlot{}, err
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

func (e *Engine) release(ctx context.Context, instance *extism.Plugin, broken bool) error {
	cleanupCtx := context.WithoutCancel(ctx)
	if broken {
		closeErr := instance.Close(cleanupCtx)
		if e.closed.Load() {
			return closeErr
		}
		replacement, err := e.compiled.Instance(cleanupCtx, extism.PluginInstanceConfig{})
		if err != nil {
			wrapped := fmt.Errorf("replace failed image codec instance: %w", err)
			e.pool <- poolSlot{err: wrapped}
			return errors.Join(closeErr, wrapped)
		}
		instance = replacement
	}

	select {
	case <-e.done:
		return instance.Close(cleanupCtx)
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
