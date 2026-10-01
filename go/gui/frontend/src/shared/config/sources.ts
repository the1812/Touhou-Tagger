export interface MetadataSourceCapabilities {
  supportsSearchCover: boolean
}

export const metadataSources: Partial<Record<string, MetadataSourceCapabilities>> = {
  'thb-wiki': { supportsSearchCover: true },
  'doujin-meta': { supportsSearchCover: true },
  'music-brainz': { supportsSearchCover: true },
  discogs: { supportsSearchCover: false },
  'local-json': { supportsSearchCover: false },
}
