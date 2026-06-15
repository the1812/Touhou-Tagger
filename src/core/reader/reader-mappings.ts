import { flacReader } from './flac/flac-reader.js'
import { MetadataReader } from './metadata-reader.js'
import { mp3Reader } from './mp3/mp3-reader.js'

export const readerMappings = {
  '.mp3': mp3Reader,
  '.flac': flacReader,
} as { [type: string]: MetadataReader }
