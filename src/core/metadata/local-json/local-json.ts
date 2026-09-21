import { readFile } from 'fs/promises'

import { resolvePath } from '../../exists.js'
import { MetadataFetchOptions, MetadataSource } from '../metadata-source.js'
import { Metadata } from '../metadata.js'
import {
  MetadataNormalizePlugin,
  expandMetadataInfo,
  expandMetadataInfoWithoutCover,
  simplifyMetadataInfo,
} from '../normalize/normalize.js'

/** @deprecated 请使用 {@link MetadataNormalizePlugin}. */
export type LocalJsonPlugin = MetadataNormalizePlugin

export class LocalJson extends MetadataSource {
  async normalize(metadatas: Metadata[], cover?: Buffer) {
    return expandMetadataInfo({ metadatas, cover })
  }
  async normalizeWithoutCover(metadatas: Metadata[]) {
    return expandMetadataInfoWithoutCover({ metadatas })
  }
  async simplify(metadatas: Metadata[]) {
    return simplifyMetadataInfo({ metadatas })
  }
  async resolveAlbumName(localSource: string) {
    return resolvePath(localSource)
  }
  async getMetadata(fullPath: string, options: MetadataFetchOptions = {}) {
    const jsonMetadata = JSON.parse(await readFile(fullPath, { encoding: 'utf8' })) as Metadata[]
    const metadata = await this.normalize(jsonMetadata, options.cover)
    return metadata
  }
}
export const localJson = new LocalJson()
