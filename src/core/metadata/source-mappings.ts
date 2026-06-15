import { doujinMeta } from './doujin-meta/doujin-meta'
import { MetadataSource } from './metadata-source'
import { thbWiki } from './thb-wiki/thb-wiki'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'doujin-meta': doujinMeta,
} as { [type: string]: MetadataSource }
