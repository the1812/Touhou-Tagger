package cli

import (
	"context"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/the1812/Touhou-Tagger/go/internal/config"
)

func (runner *Runner) command(ctx context.Context) (*cobra.Command, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	stored, err := config.Load()
	if err != nil {
		return nil, err
	}
	runner.options = newOptions(stored)
	runner.defaultSource = stored.Source
	root := &cobra.Command{
		Use:               "thtag",
		Short:             "Touhou Tagger",
		Long:              "Touhou Tagger\n\n为音乐文件写入元数据",
		Version:           runner.build.Version,
		SilenceErrors:     true,
		SilenceUsage:      true,
		CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
		Args:              cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runner.runTag(ctx)
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
		Use:   "tag",
		Short: "为音乐文件写入元数据",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runner.runTag(ctx)
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
	flags.StringVar(&runner.options.Metadata.CommentLanguage, "comment-language", runner.options.Metadata.CommentLanguage, "自定义 ID3 Tag 注释的语言 (ISO-639-2)")
	flags.Float64Var(&runner.options.Metadata.CoverCompressSize, "cover-compress-size", runner.options.Metadata.CoverCompressSize, "封面达到指定的大小 (MB) 时, 自动进行压缩 (只影响嵌入文件的封面)")
	flags.IntVar(&runner.options.Metadata.CoverCompressResolution, "cover-compress-resolution", runner.options.Metadata.CoverCompressResolution, "压缩封面时的最大边长, 超过时会进行缩放")
	flags.StringVarP(&runner.options.Metadata.Source, "source", "s", runner.options.Metadata.Source, "设置数据源")
	flags.BoolVarP(&runner.options.Metadata.LyricEnabled, "lyric", "l", false, "是否启用歌词写入 (会增加运行时间)")
	flags.StringVar((*string)(&runner.options.Metadata.Lyric.Type), "lyric-type", string(runner.options.Metadata.Lyric.Type), "歌词类型, 可以选择原文/译文/混合模式")
	flags.StringVar((*string)(&runner.options.Metadata.Lyric.Output), "lyric-output", string(runner.options.Metadata.Lyric.Output), "歌词输出方式, 可以选择写入歌曲元数据或者保存为 lrc 文件")
	flags.IntVar(&runner.options.Metadata.Lyric.MaxCacheSize, "lyric-cache-size", runner.options.Metadata.Lyric.MaxCacheSize, "下载歌词时的最大缓存数量")
	flags.StringVar(&runner.options.Metadata.Lyric.TranslationSeparator, "translation-separator", runner.options.Metadata.Lyric.TranslationSeparator, "指定混合歌词模式下, 使用的分隔符")
	flags.BoolVar(&runner.options.Metadata.Lyric.Time, "lyric-time", runner.options.Metadata.Lyric.Time, "是否启用歌词时轴")
	flags.StringVar(&runner.options.Metadata.Separator, "separator", runner.options.Metadata.Separator, "指定 mp3 元数据的分隔符")
	flags.IntVar(&runner.options.Metadata.Timeout, "timeout", runner.options.Metadata.Timeout, "指定一次运行的超时时间")
	flags.IntVar(&runner.options.Metadata.Retry, "retry", runner.options.Metadata.Retry, "指定超时后自动重试的最大次数")
	flags.BoolVarP(&runner.options.Interactive, "interactive", "i", runner.options.Interactive, "是否允许交互")
	flags.BoolVar(&runner.options.NoInteractive, "no-interactive", false, "禁用终端交互")
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
func normalizeArgs(args []string, command *cobra.Command) []string {
	aliases := map[string]string{
		"bd": "batch-depth", "ccs": "cover-compress-size", "ccr": "cover-compress-resolution",
		"lt": "lyric-type", "lo": "lyric-output", "lcs": "lyric-cache-size", "ts": "translation-separator",
	}
	result := make([]string, 0, len(args))
	flags := command.PersistentFlags()
	for index := 0; index < len(args); index++ {
		argument := args[index]
		if argument == "--" {
			result = append(result, args[index:]...)
			break
		}
		name, value, hasValue := strings.Cut(argument, "=")
		if strings.HasPrefix(name, "-") {
			if alias, exists := aliases[strings.TrimLeft(name, "-")]; exists {
				name = "--" + alias
			}
		}
		if strings.HasPrefix(name, "--no-") && name != "--no-interactive" {
			flag := flags.Lookup(strings.TrimPrefix(name, "--no-"))
			if flag != nil && flag.Value.Type() == "bool" && !hasValue {
				result = append(result, "--"+flag.Name+"=false")
				continue
			}
		}
		flag := flags.Lookup(strings.TrimPrefix(name, "--"))
		if flag == nil && len(name) == 2 && strings.HasPrefix(name, "-") {
			flag = flags.ShorthandLookup(name[1:])
		}
		if flag != nil && !hasValue && index+1 < len(args) {
			next := args[index+1]
			if flag.Value.Type() != "bool" {
				result = append(result, name, next)
				index++
				continue
			}
			if next == "true" || next == "false" {
				value, hasValue = next, true
				index++
			}
		}
		if hasValue {
			name += "=" + value
		}
		result = append(result, name)
	}
	return result
}
