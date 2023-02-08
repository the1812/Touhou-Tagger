import { thbWiki, thbWikiCache } from './thb-wiki/thb-wiki';
import { MetadataSource } from './metadata-source';
import { localMp3 } from './local-mp3/local-mp3'
import { localJson } from './local-json/local-json'
import { doujinMeta } from './doujin-meta/doujin-meta'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'thb-wiki-cache': thbWikiCache,
  'local-mp3': localMp3,
  'local-json': localJson,
  'doujin-meta': doujinMeta,
} as { [type: string]: MetadataSource }