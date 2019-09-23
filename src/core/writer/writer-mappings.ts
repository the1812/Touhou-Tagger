import { MetadataWriter } from './metadata-writer';
import { mp3Writer } from './mp3-writer';

export const writerMappings = {
  '.mp3': mp3Writer
} as { [type: string]: MetadataWriter }