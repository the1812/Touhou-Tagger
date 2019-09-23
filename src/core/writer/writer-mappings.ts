import { MetadataWriter } from './metadata-writer';
import { mp3Writer } from './mp3-writer';

export default {
  '.mp3': mp3Writer
} as { [type: string]: MetadataWriter }