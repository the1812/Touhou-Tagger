import { doujinMeta } from './doujin-meta/doujin-meta.js'
import { MetadataSource } from './metadata-source.js'
import { thbWiki } from './thb-wiki/thb-wiki.js'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'doujin-meta': doujinMeta,
} as { [type: string]: MetadataSource }
