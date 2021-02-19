import { Metadata } from './metadata'
import { MetadataConfig } from '../core-config'

export abstract class MetadataSource {
  config: MetadataConfig = {}
  coverBuffer: Buffer | undefined = undefined
  abstract resolveAlbumName(albumName: string): Promise<string[] | string>
  abstract getMetadata(albumName: string): Promise<Metadata[]>
  abstract getCover(albumName: string): Promise<Buffer | undefined>
}