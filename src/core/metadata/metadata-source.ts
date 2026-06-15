import { MetadataConfig } from '../core-config'
import { Metadata } from './metadata'

export abstract class MetadataSource {
  config: MetadataConfig
  static readonly MaxSearchCount = 20
  abstract resolveAlbumName(albumName: string): Promise<string[] | string>
  abstract getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]>
}
