package imagecodec

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"image/jpeg"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func TestCompressResizesAndEncodesProgressiveJPEG(t *testing.T) {
	ctx := context.Background()
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { closeTestEngine(t, engine) })

	input := loadExampleCover(t)
	output, err := engine.Compress(ctx, input, domain.CoverOptions{MaxDimension: 1000})
	if err != nil {
		t.Fatal(err)
	}
	if len(output) >= len(input) {
		t.Fatalf("compressed cover is not smaller: input=%d output=%d", len(input), len(output))
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(output))
	if err != nil {
		t.Fatalf("decode compressed JPEG config: %v", err)
	}
	if config.Width != 1000 || config.Height != 670 {
		t.Fatalf("unexpected compressed dimensions: %dx%d", config.Width, config.Height)
	}
	if !isProgressiveJPEG(output) {
		t.Fatal("compressed cover is not a progressive JPEG")
	}
	const squooshBaselineSize = 153815
	sizeDifference := len(output) - squooshBaselineSize
	if sizeDifference < 0 {
		sizeDifference = -sizeDifference
	}
	if float64(sizeDifference)/squooshBaselineSize > 0.05 {
		t.Fatalf("compressed size differs from Squoosh baseline: got %d, baseline %d", len(output), squooshBaselineSize)
	}
	const squooshComparedOutputSHA256 = "261fd135d9444482973ac3e459c1e5301fe0a6e62174560aa911bf4020f4c0f6"
	digest := sha256.Sum256(output)
	if actual := hex.EncodeToString(digest[:]); actual != squooshComparedOutputSHA256 {
		t.Fatalf("compressed output changed since Squoosh visual comparison: got SHA-256 %s", actual)
	}

	source, err := jpeg.Decode(bytes.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	sourceRGBA := toStraightRGBA(source)
	slot := <-engine.pool
	reference, resizeErr, broken := slot.instance.resize.run(
		ctx,
		sourceRGBA.Pix,
		sourceRGBA.Bounds().Dx(),
		sourceRGBA.Bounds().Dy(),
		1000,
		670,
	)
	if err = errors.Join(resizeErr, engine.release(ctx, slot.instance, broken)); err != nil {
		t.Fatal(err)
	}
	encoded, err := jpeg.Decode(bytes.NewReader(output))
	if err != nil {
		t.Fatal(err)
	}
	encodedRGBA := toStraightRGBA(encoded)
	var squaredError float64
	for offset := 0; offset < len(reference); offset += 4 {
		for channel := range 3 {
			difference := float64(reference[offset+channel]) - float64(encodedRGBA.Pix[offset+channel])
			squaredError += difference * difference
		}
	}
	meanSquaredError := squaredError / float64(len(reference)/4*3)
	psnr := 10 * math.Log10(255*255/meanSquaredError)
	const squooshBaselinePSNR = 36.922
	const maximumPSNRLoss = 0.1
	if psnr < squooshBaselinePSNR-maximumPSNRLoss {
		t.Fatalf("visual quality fell below the Squoosh baseline: got %.3f dB, baseline %.3f dB", psnr, squooshBaselinePSNR)
	}
}

func TestCompressReusesPipelineInstance(t *testing.T) {
	ctx := context.Background()
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { closeTestEngine(t, engine) })

	before := <-engine.pool
	engine.pool <- before
	input := loadExampleCover(t)
	for _, dimension := range []int{256, 255} {
		if _, compressErr := engine.Compress(
			ctx,
			input,
			domain.CoverOptions{MaxDimension: dimension},
		); compressErr != nil {
			t.Fatal(compressErr)
		}
	}
	after := <-engine.pool
	engine.pool <- after
	if before.instance != after.instance {
		t.Fatal("successful compression replaced the reusable WASM instances")
	}
	if after.instance.resize.module.IsClosed() || after.instance.mozjpeg.module.IsClosed() {
		t.Fatal("reused WASM instance is closed")
	}
}

func TestCompressCachesIdenticalCover(t *testing.T) {
	ctx := context.Background()
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { closeTestEngine(t, engine) })

	input := loadExampleCover(t)
	first, err := engine.Compress(ctx, input, domain.CoverOptions{MaxDimension: 256})
	if err != nil {
		t.Fatal(err)
	}
	broken := <-engine.pool
	if err := broken.instance.mozjpeg.module.Close(ctx); err != nil {
		t.Fatal(err)
	}
	engine.pool <- broken
	second, err := engine.Compress(ctx, input, domain.CoverOptions{MaxDimension: 256})
	if err != nil {
		t.Fatalf("cached compression used the closed WASM instance: %v", err)
	}
	if !bytes.Equal(first, second) {
		t.Fatal("cached compression output differs from the initial output")
	}
	if _, err := engine.Compress(ctx, input, domain.CoverOptions{MaxDimension: 255}); err == nil {
		t.Fatal("different cover options unexpectedly reused the cached output")
	}
}

func TestCloseReleasesWASMResources(t *testing.T) {
	ctx := context.Background()
	engine, err := New(ctx, Options{PoolSize: 2})
	if err != nil {
		t.Fatal(err)
	}

	slots := []poolSlot{<-engine.pool, <-engine.pool}
	for _, slot := range slots {
		engine.pool <- slot
	}
	if err = engine.Close(ctx); err != nil {
		t.Fatal(err)
	}
	for _, slot := range slots {
		if !slot.instance.resize.module.IsClosed() || !slot.instance.mozjpeg.module.IsClosed() {
			t.Fatal("closing the engine left a WASM instance open")
		}
	}
	if _, err = engine.Compress(ctx, loadExampleCover(t), domain.CoverOptions{MaxDimension: 256}); !errors.Is(err, ErrClosed) {
		t.Fatalf("compression after close returned %v, want %v", err, ErrClosed)
	}
}

func TestWASMFailureDoesNotFallBackAndReplacesInstance(t *testing.T) {
	ctx := context.Background()
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { closeTestEngine(t, engine) })

	broken := <-engine.pool
	if err := broken.instance.mozjpeg.module.Close(ctx); err != nil {
		t.Fatal(err)
	}
	engine.pool <- broken

	input := loadExampleCover(t)
	output, err := engine.Compress(ctx, input, domain.CoverOptions{MaxDimension: 256})
	if err == nil {
		t.Fatal("compression unexpectedly succeeded with a closed MozJPEG module")
	}
	if len(output) != 0 {
		t.Fatal("WASM failure returned fallback image data")
	}
	if !strings.Contains(err.Error(), "MozJPEG") {
		t.Fatalf("WASM failure lacks codec context: %v", err)
	}

	if _, err = engine.Compress(ctx, input, domain.CoverOptions{MaxDimension: 256}); err != nil {
		t.Fatalf("replacement WASM instance failed: %v", err)
	}
}

func TestEmbeddedWASMHashesMatchVersionLock(t *testing.T) {
	type moduleLock struct {
		SHA256 string `json:"sha256"`
	}
	var versions struct {
		Resize  moduleLock `json:"resize"`
		MozJPEG moduleLock `json:"mozjpeg"`
	}
	data, err := os.ReadFile(filepath.Join("..", "..", "wasm-src", "versions.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, &versions); err != nil {
		t.Fatal(err)
	}

	for name, module := range map[string]struct {
		data     []byte
		expected string
	}{
		"resize.wasm":  {data: resizeWASM, expected: versions.Resize.SHA256},
		"mozjpeg.wasm": {data: mozjpegWASM, expected: versions.MozJPEG.SHA256},
	} {
		hash := sha256.Sum256(module.data)
		if actual := hex.EncodeToString(hash[:]); actual != module.expected {
			t.Errorf("%s hash mismatch: expected %s, got %s", name, module.expected, actual)
		}
	}
}

func TestTargetDimensions(t *testing.T) {
	tests := []struct {
		name                  string
		width, height, limit  int
		wantWidth, wantHeight int
	}{
		{name: "landscape", width: 4078, height: 2734, limit: 1000, wantWidth: 1000, wantHeight: 670},
		{name: "portrait", width: 2734, height: 4078, limit: 1000, wantWidth: 670, wantHeight: 1000},
		{name: "no upscale", width: 600, height: 400, limit: 1000, wantWidth: 600, wantHeight: 400},
		{name: "disabled", width: 4078, height: 2734, limit: 0, wantWidth: 4078, wantHeight: 2734},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			width, height := targetDimensions(test.width, test.height, test.limit)
			if width != test.wantWidth || height != test.wantHeight {
				t.Fatalf("got %dx%d, want %dx%d", width, height, test.wantWidth, test.wantHeight)
			}
		})
	}
}

func TestQualityForSize(t *testing.T) {
	if quality := qualityForSize(1_117_911); quality != 91 {
		t.Fatalf("example cover quality = %d, want 91", quality)
	}
	if quality := qualityForSize(100_000_000); quality != 0 {
		t.Fatalf("large cover quality = %d, want clamped 0", quality)
	}
}

func TestCompressRejectsCanceledContext(t *testing.T) {
	engine, err := New(context.Background(), Options{PoolSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { closeTestEngine(t, engine) })

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	output, err := engine.Compress(ctx, loadExampleCover(t), domain.CoverOptions{MaxDimension: 256})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if len(output) != 0 {
		t.Fatal("canceled compression returned image data")
	}
}

func loadExampleCover(t testing.TB) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "example.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func closeTestEngine(t testing.TB, engine *Engine) {
	t.Helper()
	if err := engine.Close(context.Background()); err != nil {
		t.Errorf("close image codec: %v", err)
	}
}

func isProgressiveJPEG(data []byte) bool {
	if len(data) < 4 || data[0] != 0xff || data[1] != 0xd8 {
		return false
	}
	for offset := 2; offset+1 < len(data); {
		if data[offset] != 0xff {
			return false
		}
		for offset < len(data) && data[offset] == 0xff {
			offset++
		}
		if offset >= len(data) {
			return false
		}
		marker := data[offset]
		offset++
		if marker == 0xc2 {
			return true
		}
		if marker == 0xc0 || marker == 0xda || marker == 0xd9 {
			return false
		}
		if marker == 0x01 || marker >= 0xd0 && marker <= 0xd8 {
			continue
		}
		if offset+2 > len(data) {
			return false
		}
		length := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		if length < 2 || offset+length > len(data) {
			return false
		}
		offset += length
	}
	return false
}
