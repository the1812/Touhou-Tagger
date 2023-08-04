import type { Metadata } from '../metadata'
import { altNamesPlugin } from './alt-names'
import { commonFieldsPlugin } from './common-fields'
import { fetchCoverPlugin } from './cover'
import { inferNumberPlugin } from './infer-number'
import { omitArtistsPlugin } from './omit-artists'

export type MetadataNormalizePlugin = (init: {
  cover?: Buffer
}) => (context: { metadata: Metadata; index: number }) => void | Promise<void>

const internalNormalize = async (params: {
  plugins: MetadataNormalizePlugin[]
  metadatas: Metadata[]
  cover?: Buffer
}) => {
  const { plugins, metadatas, cover } = params
  if (!metadatas || metadatas.length === 0) {
    return metadatas
  }
  const pluginInstances = plugins.map(p => p({ cover }))
  const results = await Promise.all(
    metadatas.map(async (metadata, index) => {
      for (const instance of pluginInstances) {
        await instance({
          metadata,
          index,
        })
      }
      return metadata
    }),
  )
  return results
}

/** 为简化的 Metadata JSON 填充完整信息 */
export const normalize = async (params: { metadatas: Metadata[]; cover?: Buffer }) => {
  const plugins = [
    fetchCoverPlugin,
    omitArtistsPlugin,
    inferNumberPlugin,
    commonFieldsPlugin,
    altNamesPlugin,
  ]
  return internalNormalize({ plugins, ...params })
}

/** 为简化的 Metadata JSON 填充完整信息, 但不处理封面图 */
export const normalizeWithoutCover = async (params: { metadatas: Metadata[] }) => {
  const plugins = [omitArtistsPlugin, inferNumberPlugin, commonFieldsPlugin, altNamesPlugin]
  return internalNormalize({ plugins, ...params })
}
