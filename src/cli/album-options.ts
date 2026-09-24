import { existsSync } from 'fs'
import { readFile, unlink, writeFile } from 'fs/promises'
import { resolve } from 'path'

import { type CliOptions } from './options.js'

export interface AlbumOptions extends Partial<CliOptions> {
  defaultAlbumHint?: string
}

const AlbumOptionsFileName = 'thtag.json'
export const getAlbumOptions = async (
  workingDir: string,
  baseOptions: Partial<AlbumOptions> = {},
): Promise<AlbumOptions> => {
  const albumOptionsPath = resolve(workingDir, AlbumOptionsFileName)
  if (!existsSync(albumOptionsPath)) {
    return baseOptions
  }
  try {
    const albumOptions = JSON.parse(
      await readFile(albumOptionsPath, { encoding: 'utf-8' }),
    ) as AlbumOptions
    return {
      ...baseOptions,
      ...albumOptions,
    }
  } catch {
    return baseOptions
  }
}
export const setAlbumOptions = async (workingDir: string, options: Partial<AlbumOptions>) => {
  const albumOptionsPath = resolve(workingDir, AlbumOptionsFileName)
  const albumOptions = existsSync(albumOptionsPath)
    ? (JSON.parse(await readFile(albumOptionsPath, { encoding: 'utf-8' })) as AlbumOptions)
    : {}
  const updated = { ...albumOptions, ...options }
  if (options.source === undefined) {
    delete updated.source
  }
  if (JSON.stringify(updated) === JSON.stringify(albumOptions)) {
    return
  }
  if (Object.keys(updated).length === 0) {
    await unlink(albumOptionsPath)
    return
  }
  await writeFile(albumOptionsPath, JSON.stringify(updated, undefined, 2))
}
