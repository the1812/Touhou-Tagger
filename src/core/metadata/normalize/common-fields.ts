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
  const isMetadataFieldEqual = (value: string | string[], compareWith: string | string[]) => {
    if (Array.isArray(value) && Array.isArray(compareWith)) {
      return value.every((item, index) => compareWith[index] === item)
    }
    if (typeof value === 'string' && typeof compareWith === 'string') {
      return value === compareWith
    }
    return false
  }
  return ({ metadata, index }) => {
    if (index === 0) {
      firstMetadata = metadata
    }
    if (index > 0) {
      albumDataFields.forEach(field => {
        if (metadata[field] && isMetadataFieldEqual(metadata[field], firstMetadata[field])) {
          delete metadata[field]
        }
      })
    }
  }
}
