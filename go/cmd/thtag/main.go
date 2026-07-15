package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"

	"github.com/the1812/Touhou-Tagger/go/internal/cli"
)

var (
	version = "dev"
	commit  = ""
	date    = ""
)

func main() {
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
	_, _ = fmt.Fprintln(os.Stderr, "错误:", err)
	if errors.Is(err, context.Canceled) {
		os.Exit(130)
	}
	os.Exit(1)
}
