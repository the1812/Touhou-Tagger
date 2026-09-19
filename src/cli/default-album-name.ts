import { basename, resolve } from 'path'

import { log } from '../core/debug.js'
import { getAlbumOptions } from './album-options.js'

interface SpecialFormat {
  regex: RegExp
  resolve: (match: RegExpMatchArray) => string
}
const specialFormats: SpecialFormat[] = [
  {
    regex: /^\d{4}\.\d{2}\.\d{2} \[.+?\] (.+?)( \[.+?\])?$/,
    resolve: match => match[1],
  },
  {
    regex: /^\d{4}\.\d{2}\.\d{2} (.+?)( \[.+?\])?$/,
    resolve: match => match[1],
  },
  {
    regex: /^(.+?) \[.+?\]$/,
    resolve: match => match[1],
  },
]
export const getDefaultAlbumName = async (workingDir: string = process.cwd()) => {
  const albumOptions = await getAlbumOptions(workingDir)
  if (albumOptions.defaultAlbumHint) {
    log('defaultAlbumHint:', albumOptions.defaultAlbumHint)
    return albumOptions.defaultAlbumHint
  }
  const currentFolder = basename(resolve(workingDir))
  for (const format of specialFormats) {
    const match = currentFolder.match(format.regex)
    if (match) {
      return format.resolve(match)
    }
  }
  return currentFolder
}
