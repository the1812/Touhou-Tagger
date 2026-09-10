import { altNames } from '../alt-names.js'
import type { MetadataNormalizePlugin } from './types.js'

/** 使用 alt-names 的数据进行替换 */
export const altNamesPlugin: MetadataNormalizePlugin = () => {
  const altNameFields = ['artists', 'lyricists', 'composers'] as const
  return ({ metadata }) => {
    altNameFields.forEach(field => {
      const values = metadata[field]
      if (!values) {
        return
      }
      const replaceValues = values.map(v => {
        const replaceValue = altNames.get(v)
        if (replaceValue !== undefined) {
          return replaceValue
        }
        return v
      })
      metadata[field] = replaceValues
    })
  }
}
