import type { Metadata } from '../metadata.js'
import { altNamesPlugin } from './alt-names.js'
import { expandArtistsPlugin, simplifyArtistsPlugin } from './artists.js'
import { expandCommonFieldsPlugin, simplifyCommonFieldsPlugin } from './common-fields.js'
import { expandCoverPlugin } from './cover.js'
import { expandNumberPlugin, simplifyNumberPlugin } from './number.js'
import type { MetadataNormalizePlugin } from './types.js'

export type { MetadataNormalizePlugin } from './types.js'

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
export const expandMetadataInfo = async (params: { metadatas: Metadata[]; cover?: Buffer }) => {
  const plugins = [
    expandCoverPlugin,
    expandArtistsPlugin,
    expandNumberPlugin,
    expandCommonFieldsPlugin,
    altNamesPlugin,
  ]
  return internalNormalize({ plugins, ...params })
}

/** 为简化的 Metadata JSON 填充完整信息, 但不处理封面图 */
export const expandMetadataInfoWithoutCover = async (params: { metadatas: Metadata[] }) => {
  const plugins = [
    expandArtistsPlugin,
    expandNumberPlugin,
    expandCommonFieldsPlugin,
    altNamesPlugin,
  ]
  return internalNormalize({ plugins, ...params })
}

/** 对 Metadata JSON 进行简化 */
export const simplifyMetadataInfo = async (params: { metadatas: Metadata[]; cover?: Buffer }) => {
  const plugins = [simplifyCommonFieldsPlugin, simplifyNumberPlugin]
  return internalNormalize({ plugins, ...params })
}

/** 对 Metadata JSON 进行简化, 允许合并相同的 artists 和 composers (用于原创曲) */
export const simplifyMetadataInfoWithArtists = async (params: {
  metadatas: Metadata[]
  cover?: Buffer
}) => {
  const plugins = [simplifyCommonFieldsPlugin, simplifyNumberPlugin, simplifyArtistsPlugin]
  return internalNormalize({ plugins, ...params })
}
