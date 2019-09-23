import { Metadata } from './metadata'

export interface MetadataSource {
  resolveAlbumName: (albumName: string) => Promise<string[] | string>
  getMetadata: (albumName: string) => Promise<Metadata[]>
}