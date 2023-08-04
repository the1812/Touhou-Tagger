import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { readFileSync } from 'fs'
import { resolvePath } from '../../exists'
import { MetadataNormalizePlugin, normalize, normalizeWithoutCover } from '../normalize/normalize'

/** @deprecated 请使用 {@link MetadataNormalizePlugin}. */
export type LocalJsonPlugin = MetadataNormalizePlugin

export class LocalJson extends MetadataSource {
  async normalize(metadatas: Metadata[], cover?: Buffer) {
    return normalize({ metadatas, cover })
  }
  async normalizeWithoutCover(metadatas: Metadata[]) {
    return normalizeWithoutCover({ metadatas })
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
