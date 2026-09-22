package source

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-resty/resty/v2"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/useragent"
)

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
