import { altNames } from '../alt-names'
import { LocalJsonPlugin } from './local-json'

/** 使用 alt-names 的数据进行替换 */
export const altNamesPlugin: LocalJsonPlugin = () => {
  const altNameFields = [
    'artists',
    'lyricists',
    'composers',
  ]
  return ({ metadata }) => {
    altNameFields.forEach(field => {
      if (!altNameFields.includes(field) || !Array.isArray(metadata[field])) {
        return
      }
      const values = metadata[field] as string[]
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
