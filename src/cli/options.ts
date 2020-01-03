import * as commandLineArgs from 'command-line-args'
import { setDebug, log } from '../core/debug'
import { MetadataConfig, LyricConfig } from '../core/core-config'

export const cliOptions = commandLineArgs([
  { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
  { name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
  { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' },
  { name: 'lyric', alias: 'l', type: Boolean, defaultValue: false },
  { name: 'lyric-type', alias: 't', type: String, defaultValue: 'original' },
  { name: 'lyric-output', alias: 'o', type: String, defaultValue: 'metadata' },
]) as {
  cover: boolean
  debug: boolean
  source: string
  lyric: boolean
  'lyric-type': string
  'lyric-output': string
}
setDebug(cliOptions.debug)
export const metadataConfig: MetadataConfig = {
  lyric: cliOptions.lyric ? {
    type: cliOptions['lyric-type'],
    output: cliOptions['lyric-output'],
  } as LyricConfig : undefined
}
log(cliOptions, metadataConfig)