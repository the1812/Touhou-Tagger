import * as commandLineArgs from 'command-line-args'
import { DefaultMetadataSeparator, LyricConfig, MetadataConfig } from '../core/core-config'
import { log, setDebug } from '../core/debug'
import { loadConfigFile, saveConfigFile } from './config-file'

export interface CliOptions {
  cover: boolean
  debug: boolean
  source: string
  lyric: boolean
  batch: string
  'lyric-type': string
  'lyric-output': string
  'no-lyric-time': boolean
  'no-interactive': boolean
  [key: string]: any
}
const options = commandLineArgs([
  { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
  { name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
  { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' },
  { name: 'lyric', alias: 'l', type: Boolean, defaultValue: false },
  { name: 'batch', alias: 'b', type: String, defaultValue: '' },
  { name: 'lyric-type', alias: 't', type: String },
  { name: 'lyric-output', alias: 'o', type: String },
  { name: 'no-lyric-time', alias: 'T', type: Boolean, defaultValue: false },
  { name: 'no-interactive', alias: 'I', type: Boolean, defaultValue: false },
]) as CliOptions
if (options.batch) {
  options['no-interactive'] = true
}
setDebug(options.debug)

const configFile = loadConfigFile()
if (configFile !== null) {
  log('config file: ', configFile)
  if (configFile.lyric !== undefined) {
    if (options['lyric-output'] === undefined) {
      options['lyric-output'] = configFile.lyric.output
    }
    if (options['lyric-type'] === undefined) {
      options['lyric-type'] = configFile.lyric.type
    }
    options['translation-separator'] = configFile.lyric.translationSeparator
  }
}
const lyric = {
  type: options['lyric-type'] || 'original',
  output: options['lyric-output'] || 'metadata',
  time: !options['no-lyric-time'],
  translationSeparator: options['translation-separator'] || ' // '
} as LyricConfig
const metadata: MetadataConfig = {
  lyric: options.lyric ? lyric : undefined,
  separator: configFile ? (configFile.separator || DefaultMetadataSeparator) : DefaultMetadataSeparator,
}
log(options)
log(metadata)
saveConfigFile({ ...metadata, lyric })

export const cliOptions = options
export const lyricConfig = lyric
export const metadataConfig = metadata
