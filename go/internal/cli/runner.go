package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/imagecodec"
	"github.com/the1812/Touhou-Tagger/go/internal/source"
	"github.com/the1812/Touhou-Tagger/go/internal/source/doujinmeta"
	"github.com/the1812/Touhou-Tagger/go/internal/source/localjson"
	"github.com/the1812/Touhou-Tagger/go/internal/source/thbwiki"
	"github.com/the1812/Touhou-Tagger/go/internal/tagio"
	flactag "github.com/the1812/Touhou-Tagger/go/internal/tagio/flac"
	id3tag "github.com/the1812/Touhou-Tagger/go/internal/tagio/id3"
)

type BuildInfo struct {
	Version string
	Commit  string
	Date    string
}

type Runner struct {
	input   *bufio.Reader
	output  io.Writer
	errors  io.Writer
	codec   *imagecodec.Engine
	build   BuildInfo
	options Options
}

func Execute(ctx context.Context, args []string, build BuildInfo) error {
	codec, err := imagecodec.New(ctx, imagecodec.Options{})
	if err != nil {
		return fmt.Errorf("initialize WASM image pipeline: %w", err)
	}
	runner := &Runner{
		input:  bufio.NewReader(os.Stdin),
		output: os.Stdout,
		errors: os.Stderr,
		codec:  codec,
		build:  build,
	}
	command, err := runner.command(ctx)
	if err != nil {
		return errors.Join(err, codec.Close(context.WithoutCancel(ctx)))
	}
	command.SetArgs(args)
	runErr := command.ExecuteContext(ctx)
	closeErr := codec.Close(context.WithoutCancel(ctx))
	return errors.Join(runErr, closeErr)
}

func (runner *Runner) command(ctx context.Context) (*cobra.Command, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	stored, err := config.Load()
	if err != nil {
		return nil, err
	}
	runner.options = newOptions(stored)
	root := &cobra.Command{
		Use:           "thtag [album]",
		Short:         "Tag Touhou Project albums",
		Version:       runner.build.Version,
		SilenceErrors: true,
		SilenceUsage:  true,
		Args:          cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return runner.runTag(ctx, firstArgument(args))
		},
	}
	root.SetOut(runner.output)
	root.SetErr(runner.errors)
	root.SetVersionTemplate("{{.Version}}\n")
	runner.bindFlags(root)
	tagCommand := &cobra.Command{
		Use:   "tag [album]",
		Short: "Write metadata to an album",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return runner.runTag(ctx, firstArgument(args))
		},
	}
	dumpCommand := &cobra.Command{
		Use:   "dump",
		Short: "Extract metadata from an album",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runner.runDump(ctx)
		},
	}
	versionCommand := &cobra.Command{
		Use:   "version",
		Short: "Print build version",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			_, err := fmt.Fprintln(runner.output, runner.versionText())
			return err
		},
	}
	root.AddCommand(tagCommand, dumpCommand, versionCommand)
	return root, nil
}

func (runner *Runner) bindFlags(command *cobra.Command) {
	flags := command.PersistentFlags()
	flags.BoolVarP(&runner.options.Cover, "cover", "c", false, "save the original cover as a separate file")
	flags.BoolVarP(&runner.options.Debug, "debug", "d", false, "print debug information")
	flags.StringVarP(&runner.options.Batch, "batch", "b", "", "process album folders under this directory")
	flags.IntVar(&runner.options.BatchDepth, "batch-depth", runner.options.BatchDepth, "album folder depth in batch mode")
	flags.StringVar(&runner.options.CommentLanguage, "comment-language", runner.options.CommentLanguage, "ID3 comment ISO-639-2 language")
	flags.Float64Var(&runner.options.CoverCompressSize, "cover-compress-size", runner.options.CoverCompressSize, "compress embedded covers larger than this size in MB")
	flags.IntVar(&runner.options.CoverCompressResolution, "cover-compress-resolution", runner.options.CoverCompressResolution, "maximum cover dimension when compressing")
	flags.StringVarP(&runner.options.Source, "source", "s", runner.options.Source, "metadata source: thb-wiki or doujin-meta")
	flags.BoolVarP(&runner.options.Lyric, "lyric", "l", false, "fetch and write lyrics")
	flags.StringVar(&runner.options.LyricType, "lyric-type", runner.options.LyricType, "lyrics type: original, translated, or mixed")
	flags.StringVar(&runner.options.LyricOutput, "lyric-output", runner.options.LyricOutput, "lyrics output: metadata or lrc")
	flags.IntVar(&runner.options.LyricCacheSize, "lyric-cache-size", runner.options.LyricCacheSize, "maximum number of cached lyric pages")
	flags.StringVar(&runner.options.TranslationSeparator, "translation-separator", runner.options.TranslationSeparator, "separator for mixed lyrics")
	flags.BoolVar(&runner.options.LyricTime, "lyric-time", runner.options.LyricTime, "include lyric timestamps")
	flags.StringVar(&runner.options.Separator, "separator", runner.options.Separator, "separator for multi-value MP3 metadata")
	flags.IntVar(&runner.options.Timeout, "timeout", runner.options.Timeout, "per-attempt timeout in seconds")
	flags.IntVar(&runner.options.Retry, "retry", runner.options.Retry, "maximum attempt count")
	flags.BoolVarP(&runner.options.Interactive, "interactive", "i", runner.options.Interactive, "allow terminal prompts")
	flags.BoolVar(&runner.options.NoInteractive, "no-interactive", false, "disable terminal prompts")
}

func (runner *Runner) runTag(ctx context.Context, albumArgument string) error {
	if err := validateOptions(runner.options); err != nil {
		return err
	}
	if err := config.Save(runner.options.persistedConfig()); err != nil {
		return err
	}
	if runner.options.Debug {
		if _, err := fmt.Fprintf(runner.output, "Touhou Tagger %s\nGo metadata config: %+v\n", runner.versionText(), runner.options.metadataConfig()); err != nil {
			return err
		}
	}
	if runner.options.Batch != "" {
		return runner.runBatchTag(ctx)
	}
	directory, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("resolve working directory: %w", err)
	}
	return runner.tagDirectory(ctx, directory, albumArgument, false)
}

func (runner *Runner) runBatchTag(ctx context.Context) error {
	service, err := runner.service(runner.options)
	if err != nil {
		return err
	}
	jobs, err := service.ScanBatch(ctx, runner.options.Batch, runner.options.BatchDepth)
	if err != nil {
		return err
	}
	results := service.RunBatch(ctx, jobs, func(jobContext context.Context, job domain.BatchJob) error {
		return runner.tagDirectory(jobContext, job.Directory, job.Name, true)
	})
	var failures []error
	for _, result := range results {
		if result.Err != nil {
			failures = append(failures, fmt.Errorf("%s: %w", result.Job.Directory, result.Err))
		}
	}
	if len(failures) > 0 {
		return fmt.Errorf("%d batch albums failed: %w", len(failures), errors.Join(failures...))
	}
	return nil
}

func (runner *Runner) tagDirectory(
	ctx context.Context,
	directory string,
	albumArgument string,
	batch bool,
) error {
	options, err := runner.options.forDirectory(directory)
	if err != nil {
		return err
	}
	if err := validateOptions(options); err != nil {
		return fmt.Errorf("invalid album options for %q: %w", directory, err)
	}
	service, err := runner.service(options)
	if err != nil {
		return err
	}
	scan, err := service.ScanAlbum(ctx, directory)
	if err != nil {
		return err
	}
	albumName := albumArgument
	if albumName == "" {
		albumName, err = application.DefaultAlbumName(directory)
		if err != nil {
			return err
		}
	}
	if !batch && options.isInteractive() && scan.MetadataPath == "" {
		answer, err := runner.prompt(fmt.Sprintf("请输入专辑名称(%s): ", albumName))
		if err != nil {
			return err
		}
		if answer != "" {
			albumName = answer
		}
	}
	candidate := domain.AlbumCandidate{ID: scan.MetadataPath, Name: albumName, Source: "local-json"}
	if scan.MetadataPath == "" {
		candidates, err := service.SearchAlbums(ctx, albumName, options.Source)
		if err != nil {
			return err
		}
		var selected bool
		candidate, selected, err = runner.selectCandidate(candidates, albumName, options.isInteractive())
		if err != nil {
			return err
		}
		if !selected {
			return nil
		}
	}
	plan, _, err := service.BuildTagPlan(ctx, directory, candidate)
	if err != nil {
		return err
	}
	if options.Cover && len(plan.Items) > 0 && len(plan.Items[0].Metadata.CoverImage) > 0 {
		if _, err := application.CoverPath(directory, plan.Items[0].Metadata.CoverImage); err != nil {
			return err
		}
	}
	if err := service.ApplyTagPlan(ctx, plan); err != nil {
		return err
	}
	if options.Cover && len(plan.Items) > 0 && len(plan.Items[0].Metadata.CoverImage) > 0 {
		if _, err := application.SaveCover(directory, plan.Items[0].Metadata.CoverImage); err != nil {
			return err
		}
	}
	defaultName, err := application.DefaultAlbumName(directory)
	if err != nil {
		return err
	}
	if scan.MetadataPath == "" && candidate.Name != "" && candidate.Name != defaultName {
		if err := config.SaveDefaultAlbumHint(directory, candidate.Name); err != nil {
			return err
		}
	}
	_, err = fmt.Fprintf(runner.output, "成功写入专辑信息: %s\n", candidate.Name)
	return err
}

func (runner *Runner) selectCandidate(
	candidates []domain.AlbumCandidate,
	query string,
	interactive bool,
) (domain.AlbumCandidate, bool, error) {
	for _, candidate := range candidates {
		if candidate.Name == query {
			return candidate, true, nil
		}
	}
	if !interactive {
		if len(candidates) == 1 {
			return candidates[0], true, nil
		}
		return domain.AlbumCandidate{}, false, fmt.Errorf("album search returned %d non-exact matches", len(candidates))
	}
	if len(candidates) == 0 {
		return domain.AlbumCandidate{}, false, fmt.Errorf("no matching album found for %q", query)
	}
	for index, candidate := range candidates {
		if _, err := fmt.Fprintf(runner.output, "%d\t%s\n", index+1, candidate.Name); err != nil {
			return domain.AlbumCandidate{}, false, err
		}
	}
	answer, err := runner.prompt("输入序号选择相应条目，或输入其他字符取消: ")
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

func (runner *Runner) runDump(ctx context.Context) error {
	if err := validateOptions(runner.options); err != nil {
		return err
	}
	if err := config.Save(runner.options.persistedConfig()); err != nil {
		return err
	}
	if runner.options.Batch != "" {
		service, err := runner.service(runner.options)
		if err != nil {
			return err
		}
		jobs, err := service.ScanBatch(ctx, runner.options.Batch, runner.options.BatchDepth)
		if err != nil {
			return err
		}
		results := service.RunBatch(ctx, jobs, func(jobContext context.Context, job domain.BatchJob) error {
			return runner.dumpDirectory(jobContext, job.Directory)
		})
		var failures []error
		for _, result := range results {
			if result.Err != nil {
				failures = append(failures, fmt.Errorf("%s: %w", result.Job.Directory, result.Err))
			}
		}
		if len(failures) > 0 {
			return fmt.Errorf("%d batch albums failed: %w", len(failures), errors.Join(failures...))
		}
		return nil
	}
	directory, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("resolve working directory: %w", err)
	}
	return runner.dumpDirectory(ctx, directory)
}

func (runner *Runner) dumpDirectory(ctx context.Context, directory string) error {
	options, err := runner.options.forDirectory(directory)
	if err != nil {
		return err
	}
	if err := validateOptions(options); err != nil {
		return fmt.Errorf("invalid album options for %q: %w", directory, err)
	}
	service, err := runner.service(options)
	if err != nil {
		return err
	}
	_, err = service.DumpMetadata(ctx, directory, options.Cover)
	return err
}

func (runner *Runner) service(options Options) (*application.Service, error) {
	metadataConfig := options.metadataConfig()
	client := &http.Client{Timeout: time.Duration(metadataConfig.Timeout) * time.Second}
	wiki, err := thbwiki.New(client, "https://thwiki.cc", metadataConfig)
	if err != nil {
		return nil, err
	}
	doujin, err := doujinmeta.New(client, "https://doujin-meta.vercel.app")
	if err != nil {
		return nil, err
	}
	return &application.Service{
		Config: metadataConfig,
		Events: runner.reportProgress,
		Sources: source.Registry{
			"thb-wiki":    wiki,
			"doujin-meta": doujin,
			"local-json":  localjson.Source{},
		},
		Readers: tagio.Readers{
			domain.FormatMP3:  id3tag.Reader{},
			domain.FormatFLAC: flactag.Reader{},
		},
		Writers: tagio.Writers{
			domain.FormatMP3:  id3tag.Writer{CoverProcessor: runner.codec},
			domain.FormatFLAC: flactag.Writer{CoverProcessor: runner.codec},
		},
	}, nil
}

func (runner *Runner) reportProgress(event domain.ProgressEvent) error {
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
		message = fmt.Sprintf("提交文件: %s", event.Directory)
	case domain.StageComplete:
		message = fmt.Sprintf("完成: %s", event.Directory)
	}
	if _, err := fmt.Fprintln(runner.output, message); err != nil {
		return fmt.Errorf("write progress output: %w", err)
	}
	return nil
}

func validateOptions(options Options) error {
	if options.BatchDepth < 1 {
		return fmt.Errorf("batch depth must be at least 1")
	}
	if options.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}
	if options.Retry <= 0 {
		return fmt.Errorf("retry must be positive")
	}
	if options.CoverCompressSize < 0 || options.CoverCompressResolution < 0 {
		return fmt.Errorf("cover compression limits must not be negative")
	}
	if options.Source != "thb-wiki" && options.Source != "doujin-meta" {
		return fmt.Errorf("unsupported metadata source %q", options.Source)
	}
	if options.LyricType != "original" && options.LyricType != "translated" && options.LyricType != "mixed" {
		return fmt.Errorf("unsupported lyric type %q", options.LyricType)
	}
	if options.LyricOutput != "metadata" && options.LyricOutput != "lrc" {
		return fmt.Errorf("unsupported lyric output %q", options.LyricOutput)
	}
	if options.LyricCacheSize <= 0 {
		return fmt.Errorf("lyric cache size must be positive")
	}
	if len(options.CommentLanguage) != 3 {
		return fmt.Errorf("comment language must be a three-letter ISO-639-2 code")
	}
	return nil
}

func (runner *Runner) prompt(message string) (string, error) {
	if _, err := fmt.Fprint(runner.output, message); err != nil {
		return "", err
	}
	answer, err := runner.input.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("read terminal input: %w", err)
	}
	return strings.TrimSpace(answer), nil
}

func (runner *Runner) versionText() string {
	parts := []string{runner.build.Version}
	if runner.build.Commit != "" {
		parts = append(parts, runner.build.Commit)
	}
	if runner.build.Date != "" {
		parts = append(parts, runner.build.Date)
	}
	return strings.Join(parts, " ")
}

func firstArgument(args []string) string {
	if len(args) == 0 {
		return ""
	}
	return args[0]
}
