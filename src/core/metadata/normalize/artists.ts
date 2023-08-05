import { MetadataNormalizePlugin } from './normalize'

/** 省略 artists 且带有 composers 时, 使用 composers 填充 artists */
export const expandArtistsPlugin: MetadataNormalizePlugin = () => {
  return ({ metadata }) => {
    if (!metadata.artists && metadata.composers) {
      metadata.artists = metadata.composers
    }
  }
}

/** artists 和 composers 相同时, 省略 artists */
export const simplifyArtistsPlugin: MetadataNormalizePlugin = () => {
  return ({ metadata }) => {
    if (
      Array.isArray(metadata.artists) &&
      Array.isArray(metadata.composers) &&
      metadata.artists.every((item, index) => item === metadata.composers[index])
    ) {
      delete metadata.artists
    }
  }
}
