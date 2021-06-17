import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { readFileSync } from 'fs'
import { resolvePath } from '../../exists'
import Axios from 'axios'

export class LocalJson extends MetadataSource {
  async readCover(metadata: Metadata, cover?: Buffer) {
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
    return metadata
  }
  async resolveAlbumName(localSource: string) {
    return resolvePath(localSource)
  }
  async getMetadata(fullPath: string, cover?: Buffer) {
    const jsonMetadata = JSON.parse(readFileSync(fullPath, { encoding: 'utf8' })) as Metadata[]
    const metadata = await Promise.all(jsonMetadata.map(m => this.readCover(m, cover)))
    return metadata
  }
}
export const localJson = new LocalJson()
