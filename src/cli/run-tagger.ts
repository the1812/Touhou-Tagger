import type { Ora } from 'ora'
import { readline } from '../core/readline'
import { getDefaultAlbumName } from './default-album-name'
import { cliOptions, metadataConfig } from './options'

export const runTagger = async () => {
  let spinner: Ora
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
    const { CliTagger } = await import('./tagger')
    const tagger = new CliTagger(cliOptions, metadataConfig, spinner)
    await tagger.run(album)
    process.exit()
  }

  const defaultAlbumName = await getDefaultAlbumName()
  if (cliOptions.batch) {
    import('./batch').then(({ runBatchTagger }) => {
      runBatchTagger(cliOptions.batch, cliOptions.batchDepth)
    })
  } else if (cliOptions['no-interactive']) {
    start(defaultAlbumName)
  } else {
    readline(`请输入专辑名称(${defaultAlbumName}): `).then(album => {
      start(album || defaultAlbumName)
    })
  }
}
