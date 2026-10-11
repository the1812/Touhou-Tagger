import { MetadataConfig } from '../core-config.js'
import { Metadata } from './metadata.js'

export interface AlbumCandidate {
  id: string
  name: string
  artists?: string[]
  thumbnailUrl?: string
  description?: string
}

export interface MetadataFetchOptions {
  cover?: Buffer
  downloadCover?: boolean
}

export abstract class MetadataSource {
  declare config: MetadataConfig
  static readonly MaxSearchCount = 20
  /** @deprecated 请使用 {@link MetadataSource.search}. */
  abstract resolveAlbumName(albumName: string): Promise<string[] | string>
  /** @deprecated 请使用 {@link MetadataSource.getMetadataById}. */
  abstract getMetadata(albumName: string, options?: MetadataFetchOptions): Promise<Metadata[]>
  abstract search(query: string): Promise<AlbumCandidate[]>
  abstract getMetadataById(id: string, options?: MetadataFetchOptions): Promise<Metadata[]>
}
