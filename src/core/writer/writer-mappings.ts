import { flacWriter } from './flac/flac-writer'
import { MetadataWriter } from './metadata-writer'
import { mp3Writer } from './mp3/mp3-writer'

export const writerMappings = {
  '.mp3': mp3Writer,
  '.flac': flacWriter,
} as { [type: string]: MetadataWriter }
