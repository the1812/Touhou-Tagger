import { thbWiki } from './thb-wiki/thb-wiki';
import { MetadataSource } from './metadata-source';
import { localMp3 } from './local-mp3/local-mp3'
import { localJson } from './local-json/local-json'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'local-mp3': localMp3,
  'local-json': localJson,
} as { [type: string]: MetadataSource }