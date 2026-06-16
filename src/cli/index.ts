#!/usr/bin/env node
import { log, setDebug } from '../core/debug.js'
import { saveConfigFile } from './config-file.js'
import {
  createCliOptionsParser,
  getLyricConfig,
  getMetadataConfig,
  setCliOptions,
  type CliOptions,
} from './options.js'

const applyOptions = (options: CliOptions) => {
  if (options.debug) {
    console.log('Node.js version:', process.version)
  }
  setDebug(options.debug)

  const metadataConfig = getMetadataConfig(options)
  const lyricConfig = getLyricConfig(options)

  log(options)
  log(metadataConfig)
  saveConfigFile({ ...metadataConfig, lyric: lyricConfig })
}

const parser = createCliOptionsParser()
  .middleware(argv => {
    applyOptions(setCliOptions(Object.freeze({ ...argv }) as CliOptions))
  }, true)
  .command(['tag', '*'], '为音乐文件写入元数据', {}, async () => {
    const { runTagger } = await import('./run-tagger.js')
    await runTagger()
  })
  .command('dump', '从音乐文件提取元数据', {}, async () => {
    const { dump } = await import('./run-dumper.js')
    await dump()
  })

await parser.parseAsync()
