import { Metadata } from '../metadata'
import { LocalJsonPlugin } from './local-json'

/** 记录第一个 metadata 的公共字段, 后续可省略 */
export const commonFieldsPlugin: LocalJsonPlugin = () => {
  let firstMetadata: Metadata
  return ({ metadata, index }) => {
    if (index === 0) {
      firstMetadata = metadata
    }
    if (index > 0) {
      const albumDataFields = [
        'album',
        'albumOrder',
        'albumArtists',
        'genres',
        'year',
        'coverImage',
      ]
      albumDataFields.forEach(field => {
        if (!metadata[field]) {
          metadata[field] = firstMetadata[field]
        }
      })
    }
  }
}