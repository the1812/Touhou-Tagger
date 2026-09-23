package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"

	"github.com/the1812/Touhou-Tagger/go/internal/cli"
	"github.com/the1812/Touhou-Tagger/go/internal/useragent"
)

var (
	version = "dev"
	commit  = ""
	date    = ""
)

func main() {
	useragent.SetVersion(version)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	err := cli.Execute(ctx, os.Args[1:], cli.BuildInfo{
		Version: version,
		Commit:  commit,
		Date:    date,
	})
	if err == nil {
		return
	}
	if errors.Is(err, context.Canceled) {
		os.Exit(130)
	}
	_, _ = fmt.Fprintln(os.Stderr, "错误:", err)
	os.Exit(1)
}
