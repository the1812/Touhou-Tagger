package source

import (
	"errors"
	"fmt"
)

var ErrNotAlbum = errors.New("THBWiki page is not a doujin album entry")

type HTTPStatusError struct {
	URL        string
	StatusCode int
	Status     string
	Body       string
}

func (err *HTTPStatusError) Error() string {
	return fmt.Sprintf("request %s returned %s: %s", err.URL, err.Status, err.Body)
}
