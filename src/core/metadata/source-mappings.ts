import { discogs } from './discogs/discogs.js'
import { doujinMeta } from './doujin-meta/doujin-meta.js'
import { MetadataSource } from './metadata-source.js'
import { musicBrainz } from './musicbrainz/musicbrainz.js'
import { thbWiki } from './thb-wiki/thb-wiki.js'

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'doujin-meta': doujinMeta,
  'music-brainz': musicBrainz,
  discogs,
} as Partial<Record<string, MetadataSource>>
