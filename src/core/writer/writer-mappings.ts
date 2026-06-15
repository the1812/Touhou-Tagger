import { flacWriter } from './flac/flac-writer.js'
import { MetadataWriter } from './metadata-writer.js'
import { mp3Writer } from './mp3/mp3-writer.js'

export const writerMappings = {
  '.mp3': mp3Writer,
  '.flac': flacWriter,
} as { [type: string]: MetadataWriter }
