import { readdirSync } from 'fs'
import { join } from 'path'
import { log } from '../core/debug'
import { getDefaultAlbumName } from './default-album-name'
import { cliOptions, metadataConfig } from './options'

const readFolder = (folder: string, depth: number): { name: string; path: string }[] => {
  const currentSubFolders = readdirSync(folder, { withFileTypes: true })
    .filter(dir => dir.isDirectory())
    .map(dir => ({
      name: dir.name,
      path: join(folder, dir.name),
    }))
  if (depth <= 1) {
    return currentSubFolders
  }
  return currentSubFolders.flatMap(subFolder => readFolder(join(folder, subFolder.name), depth - 1))
}
export const runBatchTagger = async (folder: string, depth: number) => {
  const albums = readFolder(folder, depth)
  const albumCount = albums.length
  const { CliTagger } = await import('./tagger')
  const { default: ora } = await import('ora')
  for (let index = 0; index < albumCount; index++) {
    try {
      const album = getDefaultAlbumName(albums[index].name)
      const spinner = ora({
        text: '搜索中',
        spinner: {
          interval: 500,
          frames: ['.  ', '.. ', '...']
        }
      }).start()
      spinner.prefixText = `[${album}] (${index + 1}/${albumCount})`
      log(`start processing album #${index + 1}`)
      const tagger = new CliTagger(cliOptions, metadataConfig, spinner)
      tagger.workingDir = albums[index].path
      await tagger.run(album)
      log(`processed album #${index + 1}`)
    } catch (error) {
      log('batch error:', error.message)
      continue
    }
  }
  process.exit()
}
