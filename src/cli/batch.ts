import { readdirSync } from 'fs'
import { Ora } from 'ora'
import { resolve } from 'path'
import { log } from '../core/debug'
import { cliOptions, metadataConfig } from './options'

let spinner: Ora
export const runBatchTagger = async (folder: string) => {
  const albums = readdirSync(folder, { withFileTypes: true })
    .filter(dir => dir.isDirectory())
    .map(dir => dir.name)
  const albumCount = albums.length
  const { CliTagger } = await import('./tagger')
  const ora = await import('ora')
  if (!spinner) {
    spinner = ora({
      text: '搜索中',
      spinner: {
        interval: 500,
        frames: ['.  ', '.. ', '...']
      }
    }).start()
    spinner.prefixText = `[] (0/${albumCount})`
  }
  for (let index = 0; index < albumCount; index++) {
    try {
      const album = albums[index]
      spinner.prefixText = `[${album}] (${index + 1}/${albumCount})`
      log(`start processing album #${index + 1}`)
      const tagger = new CliTagger(cliOptions, metadataConfig, spinner)
      tagger.workingDir = resolve(cliOptions.batch, album)
      await tagger.run(album)
      log(`processed album #${index + 1}`)
    } catch (error) {
      log('batch error:', error.message)
      continue
    }
  }
  process.exit()
}
