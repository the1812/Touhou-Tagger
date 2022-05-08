import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { readFileSync } from 'fs'
import { resolvePath } from '../../exists'
import Axios from 'axios'

export class LocalJson extends MetadataSource {
  /**
   * Normalize JSON data from file:
   * - Cover image buffer
   * - Album metadata
   */
  async normalize(metadatas: Metadata[], cover?: Buffer) {
    if (!metadatas || metadatas.length === 0) {
      return metadatas
    }
    const [firstMetadata] = metadatas
    let cachedTrackNumber = 1
    let cachedDiscNumber = 1
    const results = await Promise.all(metadatas.map(async (metadata, index) => {
      let coverBuffer: Buffer | undefined = undefined
      if (cover !== undefined) {
        coverBuffer = cover
      } else if (typeof metadata.coverImage === 'string') {
        const response = await Axios.get<Buffer>(metadata.coverImage, {
          responseType: 'arraybuffer',
          timeout: this.config.timeout * 1000,
        })
        coverBuffer = response.data
      }
      metadata.coverImage = coverBuffer

      if (metadata.discNumber && parseInt(metadata.discNumber) !== cachedDiscNumber) {
        cachedDiscNumber = parseInt(metadata.discNumber)
        cachedTrackNumber = 1
      }
      if (!metadata.discNumber) {
        metadata.discNumber = cachedDiscNumber.toString()
      }
      if (!metadata.trackNumber) {
        metadata.trackNumber = cachedTrackNumber.toString()
      }
      cachedTrackNumber++

      if (index > 0) {
        const albumDataFields = [
          'album',
          'albumOrder',
          'albumArtists',
          'genres',
          'year',
          'coverImage',
        ]
        albumDataFields.forEach(field => {
          if (!metadata[field]) {
            metadata[field] = firstMetadata[field]
          }
        })
      }
      return metadata
    }))
    return results
  }
  async resolveAlbumName(localSource: string) {
    return resolvePath(localSource)
  }
  async getMetadata(fullPath: string, cover?: Buffer) {
    const jsonMetadata = JSON.parse(readFileSync(fullPath, { encoding: 'utf8' })) as Metadata[]
    const metadata = await this.normalize(jsonMetadata, cover)
    return metadata
  }
}
export const localJson = new LocalJson()
