import { readFile } from 'fs/promises'
import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { resolvePath } from '../../exists'
import {
  MetadataNormalizePlugin,
  expandMetadataInfo,
  expandMetadataInfoWithoutCover,
} from '../normalize/normalize'

/** @deprecated 请使用 {@link MetadataNormalizePlugin}. */
export type LocalJsonPlugin = MetadataNormalizePlugin

export class LocalJson extends MetadataSource {
  async normalize(metadatas: Metadata[], cover?: Buffer) {
    return expandMetadataInfo({ metadatas, cover })
  }
  async normalizeWithoutCover(metadatas: Metadata[]) {
    return expandMetadataInfoWithoutCover({ metadatas })
  }
  async resolveAlbumName(localSource: string) {
    return resolvePath(localSource)
  }
  async getMetadata(fullPath: string, cover?: Buffer) {
    const jsonMetadata = JSON.parse(await readFile(fullPath, { encoding: 'utf8' })) as Metadata[]
    const metadata = await this.normalize(jsonMetadata, cover)
    return metadata
  }
}
export const localJson = new LocalJson()
