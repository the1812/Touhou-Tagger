package application

import (
	"context"
	"errors"
	"runtime"
	"sync"

	"golang.org/x/sync/errgroup"
)

func processFiles(ctx context.Context, count int, action func(int) error, complete func(int, int) error) error {
	workers, pending := errgroup.WithContext(ctx)
	workers.SetLimit(min(count, runtime.GOMAXPROCS(0), 8))
	var mu sync.Mutex
	completed := 0
	for index := range count {
		if pending.Err() != nil {
			break
		}
		workers.Go(func() error {
			if pending.Err() != nil {
				return nil
			}
			if err := action(index); err != nil {
				return err
			}
			mu.Lock()
			defer mu.Unlock()
			completed++
			return complete(index, completed)
		})
	}
	return errors.Join(workers.Wait(), ctx.Err())
}
