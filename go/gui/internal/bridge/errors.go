package bridge

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"net"
	"net/url"
	"os"
	"syscall"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
)

type ErrorParams struct {
	Files  int `json:"files"`
	Tracks int `json:"tracks"`
}

type ErrorInfo struct {
	Code    string       `json:"code"`
	Params  *ErrorParams `json:"params,omitempty"`
	Message string       `json:"message"`
	Details string       `json:"details"`
}

func DescribeError(err error) ErrorInfo {
	info := ErrorInfo{Code: "unknown", Message: err.Error(), Details: err.Error()}
	var mismatch *domain.TrackCountMismatchError
	var conflict *domain.FileConflictError
	var output *coreapp.PlanOutputConflictError
	var status *source.HTTPStatusError
	var parse *domain.ParseError
	var certificate *tls.CertificateVerificationError
	var unknownAuthority x509.UnknownAuthorityError
	var invalidCertificate x509.CertificateInvalidError
	var hostname x509.HostnameError
	var network net.Error
	var connection *net.OpError
	var dns *net.DNSError
	var request *url.Error
	var invalidated *planInvalidatedError
	switch {
	case errors.As(err, &mismatch):
		info.Code = "trackMismatch"
		info.Params = &ErrorParams{Files: mismatch.Files, Tracks: mismatch.Tracks}
	case errors.As(err, &conflict):
		info.Code = "targetExists"
		if conflict.OtherPath != "" {
			info.Code = "targetConflict"
		}
	case errors.As(err, &output) && output.Kind == coreapp.OutputConflictExists:
		info.Code = "targetExists"
	case errors.As(err, &output) && output.Kind == coreapp.OutputConflictDuplicate:
		info.Code = "targetConflict"
	case errors.Is(err, source.ErrNotAlbum):
		info.Code = "notAlbum"
	case errors.Is(err, domain.ErrNoAudio):
		info.Code = "noAudio"
	case errors.Is(err, domain.ErrSourceChanged):
		info.Code = "sourceChanged"
	case errors.Is(err, domain.ErrUnsupportedFormat):
		info.Code = "unsupportedFormat"
	case errors.Is(err, context.Canceled):
		info.Code = "cancelled"
	case errors.As(err, &status):
		switch {
		case status.StatusCode == 429:
			info.Code = "rateLimited"
		case status.StatusCode == 401 || status.StatusCode == 403:
			info.Code = "accessDenied"
		case status.StatusCode == 404:
			info.Code = "notFound"
		case status.StatusCode >= 500:
			info.Code = "serverError"
		}
	case errors.As(err, &certificate), errors.As(err, &unknownAuthority), errors.As(err, &invalidCertificate), errors.As(err, &hostname):
		info.Code = "certificateFailed"
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &network) && network.Timeout():
		info.Code = "timeout"
	case errors.As(err, &connection), errors.As(err, &dns), errors.As(err, &request):
		info.Code = "connectionFailed"
	case errors.Is(err, os.ErrPermission):
		info.Code = "permissionDenied"
	case errors.Is(err, os.ErrNotExist):
		info.Code = "fileMissing"
	case errors.Is(err, syscall.ENOSPC):
		info.Code = "diskFull"
	case errors.Is(err, syscall.EBUSY):
		info.Code = "fileBusy"
	case errors.As(err, &parse):
		info.Code = "invalidConfig"
		if parse.Kind == domain.RemoteResponse {
			info.Code = "invalidResponse"
		}
	case errors.As(err, &invalidated):
		info.Code = "planInvalidated"
	default:
		if code := platformErrorCode(err); code != "" {
			info.Code = code
		}
	}
	return info
}

func MarshalError(err error) []byte {
	data, marshalErr := json.Marshal(DescribeError(err))
	if marshalErr != nil {
		return nil
	}
	return data
}

func failureIssue(code string, err error) StateIssue {
	info := DescribeError(err)
	issue := errorIssue(code, info.Message)
	issue.Error = &info
	return issue
}
