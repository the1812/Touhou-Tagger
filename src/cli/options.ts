import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { DefaultMetadataSeparator, LyricConfig, MetadataConfig } from '../core/core-config'
import { log, setDebug } from '../core/debug'
import { loadConfigFile, saveConfigFile } from './config-file'

const configFile = loadConfigFile()
const options = yargs(hideBin(process.argv))
  .parserConfiguration({
    "short-option-groups": false,
  })
  .command(['tag', '*'], '为音乐文件写入元数据', {}, () => {
    import('./run-tagger').then(({ runTagger }) => {
      runTagger()
    })
  })
  .command('dump', '从音乐文件提取元数据', {}, () => {
    import('./dump').then(({ dump }) => {
      dump()
    })
  })
  .option('comment-language', {
    type: 'string',
    default: configFile?.commentLanguage ?? 'zho',
    description: '自定义 ID3 Tag 注释的语言 (ISO-639-2)',
  })
  .option('cover', {
    alias: 'c',
    type: 'boolean',
    default: false,
    description: '是否将封面保存为独立文件',
  })
  .option('cover-compress-size', {
    alias: 'ccs',
    type: 'number',
    default: configFile?.coverCompressSize ?? 0,
    description: '封面达到指定的大小 (MB) 时, 自动进行压缩 (只影响嵌入文件的封面)',
  })
  .option('debug', {
    alias: 'd',
    type: 'boolean',
    default: false,
    description: '是否启用调试模式, 输出更杂碎的日志',
  })
  .option('source', {
    alias: 's',
    type: 'string',
    default: 'thb-wiki',
    choices: ['thb-wiki', 'thb-wiki-cache', 'doujin-meta', 'local-mp3', 'local-json'],
    description: '设置数据源',
  })
  .option('lyric', {
    alias: 'l',
    type: 'boolean',
    default: false,
    description: '是否启用歌词写入 (会增加运行时间)',
  })
  .option('lyric-type', {
    alias: 'lt',
    type: 'string',
    default: configFile?.lyric?.type ?? 'original',
    choices: ['original', 'translated', 'mixed'],
    description: '歌词类型, 可以选择原文/译文/混合模式',
  })
  .option('lyric-output', {
    alias: 'lo',
    type: 'string',
    default: configFile?.lyric?.output ?? 'metadata',
    choices: ['metadata', 'lrc'],
    description: '歌词输出方式, 可以选择写入歌曲元数据或者保存为 lrc 文件',
  })
  .option('lyric-cache-size', {
    alias: 'lcs',
    type: 'number',
    default: 16,
    description: '下载歌词时的最大缓存数量',
  })
  .option('translation-separator', {
    alias: 'ts',
    type: 'string',
    default: configFile?.lyric?.translationSeparator ?? ' // ',
    description: '指定混合歌词模式下, 使用的分隔符',
  })
  .option('lyric-time', {
    type: 'boolean',
    default: true,
    description: '是否启用歌词时轴',
  })
  .option('batch', {
    alias: 'b',
    type: 'string',
    description: '是否使用批量模式, 参数为开始批量运行的路径',
  })
  .option('batch-depth', {
    alias: 'bd',
    type: 'number',
    default: 1,
    description: '指定批量模式的文件夹层级',
  })
  .option('separator', {
    type: 'string',
    default: configFile?.separator ?? DefaultMetadataSeparator,
    description: '指定 mp3 元数据的分隔符',
  })
  .option('timeout', {
    type: 'number',
    default: configFile?.timeout ?? 30,
    description: '指定一次运行的超时时间',
  })
  .option('retry', {
    type: 'number',
    default: configFile?.retry ?? 3,
    description: '指定超时后自动重试的最大次数',
  })
  .option('interactive', {
    alias: 'i',
    type: 'boolean',
    default: true,
    description: '是否允许交互',
  })
  .parseSync()

setDebug(options.debug)
const lyric = {
  type: options.lyricType,
  output: options.lyricOutput,
  time: options.lyricTime,
  translationSeparator: options.translationSeparator,
  maxCacheSize: options.lyricCacheSize,
} as LyricConfig
const metadata: MetadataConfig = {
  lyric: options.lyric ? lyric : undefined,
  commentLanguage: options.commentLanguage,
  coverCompressSize: options.coverCompressSize,
  separator: options.separator,
  timeout: options.timeout,
  retry: options.retry,
}
log(options)
log(metadata)
saveConfigFile({ ...metadata, lyric })

export const cliOptions = options
export type CliOptions = typeof options
export const lyricConfig = lyric
export const metadataConfig = metadata
