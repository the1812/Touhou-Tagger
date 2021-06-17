import { thbWiki } from './thb-wiki/thb-wiki';
import { MetadataSource } from './metadata-source';
import { localMp3 } from './local-mp3/local-mp3'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'local-mp3': localMp3,
} as { [type: string]: MetadataSource }