package bridge

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

func (backend *Backend) AssetHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if !strings.HasPrefix(request.URL.Path, "/gui/preview/") {
			next.ServeHTTP(response, request)
			return
		}
		backend.servePreview(response, request)
	})
}

func (backend *Backend) servePreview(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", "GET, HEAD")
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.Trim(request.URL.Path, "/"), "/")
	if len(parts) != 4 || parts[0] != "gui" || parts[1] != "preview" || parts[3] != "cover" {
		http.NotFound(response, request)
		return
	}
	revision, err := strconv.Atoi(request.URL.Query().Get("revision"))
	if err != nil || revision < 1 {
		http.NotFound(response, request)
		return
	}
	session, exists := backend.plans.get(parts[2])
	if !exists {
		http.NotFound(response, request)
		return
	}
	session.mu.Lock()
	if session.revision != revision || len(session.cover) == 0 {
		session.mu.Unlock()
		http.NotFound(response, request)
		return
	}
	cover := append([]byte(nil), session.cover...)
	session.mu.Unlock()
	cover, contentType, err := browserCover(cover)
	if err != nil {
		http.NotFound(response, request)
		return
	}
	response.Header().Set("Content-Type", contentType)
	response.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	response.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(response, request, "cover", time.Time{}, bytes.NewReader(cover))
}

func browserCover(data []byte) ([]byte, string, error) {
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("decode image: %w", err)
	}
	if config.Width < 1 || config.Height < 1 {
		return nil, "", fmt.Errorf("image dimensions are invalid")
	}
	if format != "tiff" {
		return data, http.DetectContentType(data), nil
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("decode TIFF preview: %w", err)
	}
	var output bytes.Buffer
	if err := png.Encode(&output, decoded); err != nil {
		return nil, "", fmt.Errorf("encode TIFF preview: %w", err)
	}
	return output.Bytes(), "image/png", nil
}

func decodeCover(data []byte) (int, int, error) {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0, fmt.Errorf("decode image: %w", err)
	}
	if config.Width < 1 || config.Height < 1 {
		return 0, 0, fmt.Errorf("image dimensions are invalid")
	}
	return config.Width, config.Height, nil
}
