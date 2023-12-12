import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'

export interface AlbumOptions {
  defaultAlbumHint?: string
}

const AlbumOptionsFileName = 'thtag.json'
export const getAlbumOptions = async (
  workingDir: string,
  fallback: Partial<AlbumOptions> = {},
): Promise<AlbumOptions> => {
  const albumOptionsPath = resolve(workingDir, AlbumOptionsFileName)
  if (!existsSync(albumOptionsPath)) {
    return fallback
  }
  try {
    const albumOptions = JSON.parse(
      await readFile(albumOptionsPath, { encoding: 'utf-8' }),
    ) as AlbumOptions
    return {
      ...fallback,
      ...albumOptions,
    }
  } catch (error) {
    return fallback
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
