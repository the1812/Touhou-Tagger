import { thbWiki } from './thb-wiki/thb-wiki'
import { MetadataSource } from './metadata-source'
import { doujinMeta } from './doujin-meta/doujin-meta'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'doujin-meta': doujinMeta,
} as { [type: string]: MetadataSource }
