import { MetadataConfig } from '../core-config.js'
import { Metadata } from './metadata.js'

export interface MetadataFetchOptions {
  cover?: Buffer
  downloadCover?: boolean
}

export abstract class MetadataSource {
  declare config: MetadataConfig
  static readonly MaxSearchCount = 20
  abstract resolveAlbumName(albumName: string): Promise<string[] | string>
  abstract getMetadata(albumName: string, options?: MetadataFetchOptions): Promise<Metadata[]>
}
