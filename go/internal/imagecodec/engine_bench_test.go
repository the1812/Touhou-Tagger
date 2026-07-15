package imagecodec

import (
	"bytes"
	"context"
	"image"
	"testing"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

func BenchmarkEngineInitialization(b *testing.B) {
	ctx := context.Background()
	b.ReportAllocs()
	for b.Loop() {
		engine, err := New(ctx, Options{PoolSize: 1})
		if err != nil {
			b.Fatal(err)
		}
		if err = engine.Close(ctx); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkResizeWASM(b *testing.B) {
	ctx := context.Background()
	input := loadExampleCover(b)
	decoded, _, err := image.Decode(bytes.NewReader(input))
	if err != nil {
		b.Fatal(err)
	}
	rgba := toStraightRGBA(decoded)
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { closeTestEngine(b, engine) })
	instance := (<-engine.pool).instance
	b.ReportAllocs()
	b.SetBytes(int64(len(rgba.Pix)))
	b.ResetTimer()
	for b.Loop() {
		if _, err, _ = instance.resize.run(
			ctx,
			rgba.Pix,
			rgba.Bounds().Dx(),
			rgba.Bounds().Dy(),
			1000,
			670,
		); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkMozJPEGWASM(b *testing.B) {
	ctx := context.Background()
	input := loadExampleCover(b)
	decoded, _, err := image.Decode(bytes.NewReader(input))
	if err != nil {
		b.Fatal(err)
	}
	rgba := toStraightRGBA(decoded)
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { closeTestEngine(b, engine) })
	instance := (<-engine.pool).instance
	resized, err, _ := instance.resize.run(
		ctx,
		rgba.Pix,
		rgba.Bounds().Dx(),
		rgba.Bounds().Dy(),
		1000,
		670,
	)
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.SetBytes(int64(len(resized)))
	b.ResetTimer()
	for b.Loop() {
		if _, err, _ = instance.mozjpeg.run(ctx, resized, 1000, 670, qualityForSize(len(input))); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkCompressReuse(b *testing.B) {
	ctx := context.Background()
	input := loadExampleCover(b)
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { closeTestEngine(b, engine) })
	b.ReportAllocs()
	b.SetBytes(int64(len(input)))
	b.ResetTimer()
	var output []byte
	for b.Loop() {
		engine.cacheMu.Lock()
		engine.cache = coverCache{}
		engine.cacheMu.Unlock()
		if output, err = engine.Compress(
			ctx,
			input,
			domain.CoverOptions{MaxDimension: 1000},
		); err != nil {
			b.Fatal(err)
		}
	}
	b.ReportMetric(float64(len(output)), "output-B")
}

func BenchmarkCompressCachedCover(b *testing.B) {
	ctx := context.Background()
	input := loadExampleCover(b)
	engine, err := New(ctx, Options{PoolSize: 1})
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { closeTestEngine(b, engine) })
	options := domain.CoverOptions{MaxDimension: 1000}
	if _, err = engine.Compress(ctx, input, options); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.SetBytes(int64(len(input)))
	b.ResetTimer()
	for b.Loop() {
		if _, err = engine.Compress(ctx, input, options); err != nil {
			b.Fatal(err)
		}
	}
}
