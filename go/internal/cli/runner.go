package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/bootstrap"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	"github.com/the1812/Touhou-Tagger/go/internal/imagecodec"
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
		Use:               "thtag [album]",
		Short:             "Touhou Tagger",
		Long:              "Touhou Tagger\n\n为音乐文件写入元数据",
		Version:           runner.build.Version,
		SilenceErrors:     true,
		SilenceUsage:      true,
		CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
		Args:              cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return runner.runTag(ctx, firstArgument(args))
		},
	}
	root.SetOut(runner.output)
	root.SetErr(runner.errors)
	root.SetVersionTemplate("{{.Version}}\n")
	root.SetUsageTemplate(strings.ReplaceAll(root.UsageTemplate(), "Flags:", "Options:"))
	runner.bindFlags(root)
	root.InitDefaultHelpFlag()
	root.InitDefaultVersionFlag()
	root.Flags().Lookup("help").Usage = "显示帮助信息"
	root.Flags().Lookup("version").Usage = "显示版本号"
	tagCommand := &cobra.Command{
		Use:   "tag [album]",
		Short: "为音乐文件写入元数据",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return runner.runTag(ctx, firstArgument(args))
		},
	}
	dumpCommand := &cobra.Command{
		Use:   "dump",
		Short: "从音乐文件提取元数据",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runner.runDump(ctx)
		},
	}
	versionCommand := &cobra.Command{
		Use:   "version",
		Short: "显示构建版本",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			_, err := fmt.Fprintln(runner.output, runner.versionText())
			return err
		},
	}
	root.AddCommand(tagCommand, dumpCommand, versionCommand)
	root.InitDefaultHelpCmd()
	for _, command := range root.Commands() {
		if command.Name() == "help" {
			command.Short = "显示任何命令的帮助信息"
			command.Long = "显示任何命令的帮助信息。"
			break
		}
	}
	return root, nil
}

func (runner *Runner) bindFlags(command *cobra.Command) {
	flags := command.PersistentFlags()
	flags.BoolVarP(&runner.options.Cover, "cover", "c", false, "是否将封面保存为独立文件")
	flags.BoolVarP(&runner.options.Debug, "debug", "d", false, "是否启用调试模式, 输出更杂碎的日志")
	flags.StringVarP(&runner.options.Batch, "batch", "b", "", "是否使用批量模式, 参数为开始批量运行的路径")
	flags.IntVar(&runner.options.BatchDepth, "batch-depth", runner.options.BatchDepth, "指定批量模式的文件夹层级")
	flags.StringVar(&runner.options.CommentLanguage, "comment-language", runner.options.CommentLanguage, "自定义 ID3 Tag 注释的语言 (ISO-639-2)")
	flags.Float64Var(&runner.options.CoverCompressSize, "cover-compress-size", runner.options.CoverCompressSize, "封面达到指定的大小 (MB) 时, 自动进行压缩 (只影响嵌入文件的封面)")
	flags.IntVar(&runner.options.CoverCompressResolution, "cover-compress-resolution", runner.options.CoverCompressResolution, "压缩封面时的最大边长, 超过时会进行缩放")
	flags.StringVarP(&runner.options.Source, "source", "s", runner.options.Source, "设置数据源")
	flags.BoolVarP(&runner.options.Lyric, "lyric", "l", false, "是否启用歌词写入 (会增加运行时间)")
	flags.StringVar(&runner.options.LyricType, "lyric-type", runner.options.LyricType, "歌词类型, 可以选择原文/译文/混合模式")
	flags.StringVar(&runner.options.LyricOutput, "lyric-output", runner.options.LyricOutput, "歌词输出方式, 可以选择写入歌曲元数据或者保存为 lrc 文件")
	flags.IntVar(&runner.options.LyricCacheSize, "lyric-cache-size", runner.options.LyricCacheSize, "下载歌词时的最大缓存数量")
	flags.StringVar(&runner.options.TranslationSeparator, "translation-separator", runner.options.TranslationSeparator, "指定混合歌词模式下, 使用的分隔符")
	flags.BoolVar(&runner.options.LyricTime, "lyric-time", runner.options.LyricTime, "是否启用歌词时轴")
	flags.StringVar(&runner.options.Separator, "separator", runner.options.Separator, "指定 mp3 元数据的分隔符")
	flags.IntVar(&runner.options.Timeout, "timeout", runner.options.Timeout, "指定一次运行的超时时间")
	flags.IntVar(&runner.options.Retry, "retry", runner.options.Retry, "指定超时后自动重试的最大次数")
	flags.BoolVarP(&runner.options.Interactive, "interactive", "i", runner.options.Interactive, "是否允许交互")
	flags.BoolVar(&runner.options.NoInteractive, "no-interactive", false, "禁用终端交互")
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
		if candidate.MatchesName(query) {
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
	return bootstrap.NewService(bootstrap.Options{
		Config:         metadataConfig,
		Events:         runner.reportProgress,
		Warnings:       runner.reportWarning,
		CoverProcessor: runner.codec,
	})
}

func (runner *Runner) reportWarning(warning application.ProcessWarning) error {
	if _, err := fmt.Fprintf(
		runner.errors,
		"警告: %s\n详情: %s\n",
		warning.Message,
		warning.Err,
	); err != nil {
		return fmt.Errorf("write warning output: %w", err)
	}
	return nil
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
	case domain.StageCommit:
		message = fmt.Sprintf("提交文件: %s", event.Directory)
	case domain.StageRename:
		message = fmt.Sprintf("重命名文件: %s", event.Directory)
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
	if err := config.ValidateMetadata(options.persistedConfig()); err != nil {
		return err
	}
	if options.Source != "thb-wiki" && options.Source != "doujin-meta" {
		return fmt.Errorf("unsupported metadata source %q", options.Source)
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
