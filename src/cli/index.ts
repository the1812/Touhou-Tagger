#!/usr/bin/env node
import { cliOptions, metadataConfig } from './options'
import { Ora } from 'ora'
import { readline } from '../core/readline'
import { getDefaultAlbumName } from './default-album-name'

let spinner: Ora
const runTagger = async (album: string) => {
  const { default: ora } = await import('ora')
  if (!spinner) {
    spinner = ora({
      text: '搜索中',
      spinner: {
        interval: 500,
        frames: ['.  ', '.. ', '...']
      }
    }).start()
  }
  const { CliTagger } = await import('./tagger')
  const tagger = new CliTagger(cliOptions, metadataConfig, spinner)
  await tagger.run(album)
  process.exit()
}

const defaultAlbumName = getDefaultAlbumName()
if (cliOptions.batch) {
  import('./batch').then(({ runBatchTagger }) => {
    runBatchTagger(cliOptions.batch, cliOptions.batchDepth)
  })
} else if (cliOptions['no-interactive']) {
  runTagger(defaultAlbumName)
} else {
  readline(`请输入专辑名称(${defaultAlbumName}): `).then(album => {
    runTagger(album || defaultAlbumName)
  })
}
