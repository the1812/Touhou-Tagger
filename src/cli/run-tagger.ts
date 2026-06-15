import type { Ora } from 'ora'

import { readline } from '../core/readline'
import { getDefaultAlbumName } from './default-album-name'
import { getCliOptions } from './options'

export const runTagger = async () => {
  let spinner: Ora
  const cliOptions = getCliOptions()
  const start = async (album: string) => {
    const { default: ora } = await import('ora')
    if (!spinner) {
      spinner = ora({
        text: '搜索中',
        spinner: {
          interval: 500,
          frames: ['.  ', '.. ', '...'],
        },
      }).start()
    }
    const { CliTagger } = await import('./tagger.js')
    const tagger = new CliTagger(spinner)
    await tagger.run(album)
    process.exit()
  }

  const defaultAlbumName = await getDefaultAlbumName()
  if (cliOptions.batch) {
    const { runBatchTagger } = await import('./batch.js')
    await runBatchTagger(cliOptions.batch, cliOptions.batchDepth)
  } else if (cliOptions['no-interactive']) {
    await start(defaultAlbumName)
  } else {
    const album = await readline(`请输入专辑名称(${defaultAlbumName}): `)
    await start(album || defaultAlbumName)
  }
}
