import { Metadata } from './metadata'
import { MetadataConfig } from '../core-config'

export abstract class MetadataSource {
  config: MetadataConfig
  abstract resolveAlbumName(albumName: string): Promise<string[] | string>
  abstract getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]>
}
