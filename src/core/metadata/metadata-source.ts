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
  abstract search(query: string): Promise<AlbumCandidate[]>
  abstract getMetadata(id: string, options?: MetadataFetchOptions): Promise<Metadata[]>
}
