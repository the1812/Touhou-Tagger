package source

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/useragent"
)

type RequestLimiter struct {
	mu       sync.Mutex
	next     time.Time
	interval time.Duration
}

func NewRequestLimiter(interval time.Duration) *RequestLimiter {
	return &RequestLimiter{interval: interval}
}

func (limiter *RequestLimiter) Wait(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	timer := time.NewTimer(time.Until(limiter.next))
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		limiter.next = time.Now().Add(limiter.interval)
		return ctx.Err()
	}
}

func NewHTTPClient(client *http.Client) *resty.Client {
	return resty.NewWithClient(client).
		SetHeader("User-Agent", useragent.TouhouTagger()).
		SetJSONUnmarshaler(func(data []byte, value any) error {
			if err := json.Unmarshal(data, value); err != nil {
				return &domain.ParseError{Kind: domain.RemoteResponse, Err: err}
			}
			return nil
		}).
		OnAfterResponse(func(_ *resty.Client, response *resty.Response) error {
			if response.IsSuccess() {
				return nil
			}
			return &HTTPStatusError{
				URL:        response.Request.URL,
				StatusCode: response.StatusCode(),
				Status:     response.Status(),
				Body:       strings.TrimSpace(response.String()),
			}
		})
}
