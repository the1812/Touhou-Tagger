import { MetadataReader } from './metadata-reader'
import { mp3Reader } from './mp3/mp3-reader'

export const readerMappings = {
  '.mp3': mp3Reader,
} as { [type: string]: MetadataReader }
