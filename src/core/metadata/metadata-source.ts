import { Metadata } from './metadata'
import { MetadataConfig } from '../core-config'

export abstract class MetadataSource {
  config: MetadataConfig
  static readonly MaxSearchCount = 20
  abstract resolveAlbumName(albumName: string): Promise<string[] | string>
  abstract getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]>
}
