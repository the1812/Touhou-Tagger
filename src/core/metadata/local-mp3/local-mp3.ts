import { Dirent } from 'fs'
import id3 from 'node-id3'
import { readdir } from 'fs/promises'
import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { resolvePath } from '../../exists'
import { defaultsToEmptyString } from '../../proxy'

const dirFilter = async <Result = string>(
  path: string,
  predicate: (d: Dirent) => boolean,
  mapper: (name: string) => Result = name => name as Result,
) => {
  return (await readdir(path, { withFileTypes: true })).filter(predicate).map(it => mapper(it.name))
}
export class LocalMp3 extends MetadataSource {
  async resolveAlbumName(localSource: string) {
    return resolvePath(localSource)
  }
  private async getMultipleDiscFiles(path: string): Promise<string[][]> {
    const { join } = await import('path')
    const subFolders = await dirFilter(path, it => it.isDirectory() && /^Disc (\d+)/.test(it.name))
    const mp3Filter = (it: Dirent) => it.isFile() && it.name.endsWith('.mp3')
    if (subFolders.length > 0) {
      return Promise.all(
        subFolders.map(async folder => {
          return dirFilter(join(path, folder), mp3Filter, name => join(path, folder, name))
        }),
      )
    }
    return [await dirFilter(path, mp3Filter, name => join(path, name))]
  }
  async getMetadata(fullPath: string, cover?: Buffer) {
    const discs = await this.getMultipleDiscFiles(fullPath)
    const metadatas = discs.flatMap((discFiles, index) => {
      const discNumber = (index + 1).toString()
      return discFiles.map(file => {
        const tags = defaultsToEmptyString(id3.read(file))
        const { separator } = this.config
        const metadata: Metadata = {
          title: tags.title,
          artists: tags.artist.split(separator),
          discNumber,
          trackNumber: tags.trackNumber,
          composers: tags.composer ? tags.composer.split(separator) : undefined,
          comments: tags.comment ? tags.comment.text : undefined,
          lyricists: tags.textWriter ? tags.textWriter.split(separator) : undefined,
          album: tags.album,
          albumOrder: tags.albumOrder || '',
          albumArtists: tags.performerInfo ? tags.performerInfo.split(separator) : undefined,
          genres: tags.genre ? tags.genre.split(separator) : undefined,
          year: tags.year || undefined,
          coverImage: (tags.image && tags.image.imageBuffer) || cover || undefined,
        }
        if (this.config.lyric && tags.unsynchronisedLyrics) {
          metadata.lyric = tags.unsynchronisedLyrics.text
          metadata.lyricLanguage = tags.unsynchronisedLyrics.language
        }
        return metadata
      })
    })
    return metadatas
  }
}
export const localMp3 = new LocalMp3()
