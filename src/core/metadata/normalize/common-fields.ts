import { Metadata } from '../metadata'
import { MetadataNormalizePlugin } from './normalize'

const albumDataFields: string[] = [
  'album',
  'albumOrder',
  'albumArtists',
  'genres',
  'year',
  'coverImage',
] satisfies (keyof Metadata)[]
/** 将第一个 metadata 的公共字段复制给后续的 metadata */
export const expandCommonFieldsPlugin: MetadataNormalizePlugin = () => {
  let firstMetadata: Metadata
  return ({ metadata, index }) => {
    if (index === 0) {
      firstMetadata = metadata
    }
    if (index > 0) {
      albumDataFields.forEach(field => {
        if (!metadata[field]) {
          metadata[field] = firstMetadata[field]
        }
      })
    }
  }
}

export const simplifyCommonFieldsPlugin: MetadataNormalizePlugin = () => {
  let firstMetadata: Metadata
  return ({ metadata, index }) => {
    if (index === 0) {
      firstMetadata = metadata
    }
    if (index > 0) {
      albumDataFields.forEach(field => {
        if (metadata[field] && metadata[field] === firstMetadata[field]) {
          delete metadata[field]
        }
      })
    }
  }
}
