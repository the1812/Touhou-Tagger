import { MetadataNormalizePlugin } from './normalize'

/** 省略 artists 且带有 composers 时, 使用 composers 填充 artists */
export const expandArtistsPlugin: MetadataNormalizePlugin = () => {
  return ({ metadata }) => {
    if (!metadata.artists && metadata.composers) {
      metadata.artists = metadata.composers
    }
  }
}
