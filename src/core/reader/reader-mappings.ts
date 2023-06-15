import { MetadataReader } from './metadata-reader'
import { mpeReader } from './mp3/mp3-reader'

export const readerMappings = {
  '.mp3': mpeReader,
} as { [type: string]: MetadataReader }
