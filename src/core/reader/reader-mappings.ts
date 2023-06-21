import { MetadataReader } from './metadata-reader'
import { mp3Reader } from './mp3/mp3-reader'
import { flacReader } from './flac/flac-reader'

export const readerMappings = {
  '.mp3': mp3Reader,
  '.flac': flacReader,
} as { [type: string]: MetadataReader }
