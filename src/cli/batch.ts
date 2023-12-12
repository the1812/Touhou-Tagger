import { join } from 'path'
import type { Options as OraOptions, Ora } from 'ora'
import { readdir } from 'fs/promises'
import { log } from '../core/debug'
import { getDefaultAlbumName } from './default-album-name'
import { cliOptions, metadataConfig } from './options'
import { asyncFlatMap } from './helper'

const readFolder = async (
  folder: string,
  depth: number,
): Promise<{ name: string; path: string }[]> => {
  const currentSubFolders = (await readdir(folder, { withFileTypes: true }))
    .filter(dir => dir.isDirectory())
    .map(dir => ({
      name: dir.name,
      path: join(folder, dir.name),
    }))
  if (depth <= 1) {
    return currentSubFolders
  }
  const allSubFolders = await asyncFlatMap(currentSubFolders, subFolder =>
    readFolder(join(folder, subFolder.name), depth - 1),
  )
  return allSubFolders
}

const createBatchRun = async (config: {
  folder: string
  depth: number
  oraOptions: OraOptions
  onProcess: (context: {
    currentAlbum: string
    workingDir: string
    spinner: Ora
    index: number
  }) => Promise<void>
}) => {
  const { folder, depth, oraOptions, onProcess } = config
  const albums = await readFolder(folder, depth)
  const albumCount = albums.length
  const { default: ora } = await import('ora')
  for (let index = 0; index < albumCount; index++) {
    try {
      const album = await getDefaultAlbumName(albums[index].name)
      const spinner = ora(oraOptions).start()
      spinner.prefixText = `[${album}] (${index + 1}/${albumCount})`
      log(`start processing album #${index + 1}`)
      await onProcess({
        currentAlbum: album,
        workingDir: albums[index].path,
        spinner,
        index,
      })
      log(`processed album #${index + 1}`)
    } catch (error) {
      log('batch error:', error.message)
      continue
    }
  }
  process.exit()
}

export const runBatchTagger = async (folder: string, depth: number) => {
  const { CliTagger } = await import('./tagger')
  await createBatchRun({
    folder,
    depth,
    oraOptions: {
      text: '搜索中',
      spinner: {
        interval: 500,
        frames: ['.  ', '.. ', '...'],
      },
    },
    onProcess: async ({ currentAlbum, workingDir, spinner }) => {
      const tagger = new CliTagger(cliOptions, metadataConfig, spinner)
      tagger.workingDir = workingDir
      await tagger.run(currentAlbum)
    },
  })
}
export const runBatchDump = async (folder: string, depth: number) => {
  const { CliDumper } = await import('./dumper')
  await createBatchRun({
    folder,
    depth,
    oraOptions: {
      text: '提取中',
      spinner: {
        interval: 500,
        frames: ['.  ', '.. ', '...'],
      },
    },
    onProcess: async ({ workingDir, spinner }) => {
      const tagger = new CliDumper(cliOptions)
      tagger.workingDir = workingDir
      await tagger.run()
      spinner.stop()
    },
  })
}
