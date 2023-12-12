import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { CliOptions } from './options'

export interface AlbumOptions extends Partial<CliOptions> {
  defaultAlbumHint?: string
}

const AlbumOptionsFileName = 'thtag.json'
export const getAlbumOptions = async (
  workingDir: string,
  baseOptions: Partial<CliOptions> = {},
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
  } catch (error) {
    return baseOptions
  }
}
export const setAlbumOptions = async (workingDir: string, options: Partial<AlbumOptions>) => {
  const albumOptionsPath = resolve(workingDir, AlbumOptionsFileName)
  try {
    const albumOptions = JSON.parse(
      await readFile(albumOptionsPath, { encoding: 'utf-8' }),
    ) as AlbumOptions
    await writeFile(
      albumOptionsPath,
      JSON.stringify(
        {
          ...albumOptions,
          ...options,
        },
        undefined,
        2,
      ),
    )
  } catch (error) {
    await writeFile(albumOptionsPath, JSON.stringify(options, undefined, 2))
  }
}
