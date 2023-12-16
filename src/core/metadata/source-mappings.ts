import { thbWiki, thbWikiCache } from './thb-wiki/thb-wiki'
import { MetadataSource } from './metadata-source'
import { doujinMeta } from './doujin-meta/doujin-meta'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'thb-wiki-cache': thbWikiCache,
  'doujin-meta': doujinMeta,
} as { [type: string]: MetadataSource }
