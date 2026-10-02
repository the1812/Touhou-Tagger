package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type terminal struct {
	input  *bufio.Reader
	output io.Writer
	errors io.Writer
}

func (terminal *terminal) selectCandidate(
	ctx context.Context,
	candidates []domain.AlbumCandidate,
	query string,
	interactive bool,
) (domain.AlbumCandidate, bool, error) {
	if len(candidates) == 1 && (!interactive || candidates[0].MatchesName(query)) {
		return candidates[0], true, nil
	}
	if !interactive {
		return domain.AlbumCandidate{}, false, fmt.Errorf("album search returned %d candidates; expected one", len(candidates))
	}
	if len(candidates) == 0 {
		return domain.AlbumCandidate{}, false, fmt.Errorf("no matching album found for %q", query)
	}
	for index, candidate := range candidates {
		label := candidate.Name
		if candidate.Description != "" {
			label += " · " + candidate.Description
		}
		if _, err := fmt.Fprintf(terminal.output, "%d\t%s\n", index+1, label); err != nil {
			return domain.AlbumCandidate{}, false, err
		}
	}
	answer, err := terminal.prompt(ctx, "输入序号选择相应条目，或输入其他字符取消: ")
	if err != nil {
		return domain.AlbumCandidate{}, false, err
	}
	index, valid := candidateIndex(answer, len(candidates))
	if !valid {
		return domain.AlbumCandidate{}, false, nil
	}
	return candidates[index-1], true, nil
}
func candidateIndex(value string, candidateCount int) (int, bool) {
	index, err := strconv.Atoi(value)
	return index, err == nil && index >= 1 && index <= candidateCount
}
func (terminal *terminal) reportProgress(event domain.ProgressEvent, debug bool) error {
	if !debug {
		if event.Stage != domain.StageSearch && event.Stage != domain.StageFetch {
			return nil
		}
		message := "搜索中"
		if event.Stage == domain.StageFetch {
			message = "下载专辑信息中"
		}
		_, err := fmt.Fprintln(terminal.errors, message)
		return err
	}
	var message string
	switch event.Stage {
	case domain.StageScan:
		message = fmt.Sprintf("扫描专辑: %s", event.Directory)
	case domain.StageSearch:
		message = fmt.Sprintf("搜索专辑: %s", event.Message)
	case domain.StageFetch:
		message = fmt.Sprintf("获取元数据: %s", event.Message)
	case domain.StagePlan:
		message = fmt.Sprintf("写入计划: %d 首曲目", event.Total)
	case domain.StageWrite:
		action := "写入标签"
		if event.Message == "read metadata" {
			action = "读取标签"
		}
		message = fmt.Sprintf("%s [%d/%d]: %s", action, event.Current, event.Total, event.Path)
	case domain.StageRename:
		message = fmt.Sprintf("重命名文件: %s", event.Directory)
	case domain.StageComplete:
		message = fmt.Sprintf("完成: %s", event.Directory)
	}
	if _, err := fmt.Fprintln(terminal.output, message); err != nil {
		return fmt.Errorf("write progress output: %w", err)
	}
	return nil
}
func (terminal *terminal) prompt(ctx context.Context, message string) (string, error) {
	if _, err := fmt.Fprint(terminal.output, message); err != nil {
		return "", err
	}
	type inputResult struct {
		answer string
		err    error
	}
	result := make(chan inputResult, 1)
	go func() {
		answer, err := terminal.input.ReadString('\n')
		result <- inputResult{answer: answer, err: err}
	}()
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case input := <-result:
		if err := ctx.Err(); err != nil {
			return "", err
		}
		if errors.Is(input.err, io.EOF) {
			return "", context.Canceled
		}
		if input.err != nil {
			return "", fmt.Errorf("read terminal input: %w", input.err)
		}
		return strings.TrimSpace(input.answer), nil
	}
}
