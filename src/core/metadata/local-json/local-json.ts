import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { readFileSync } from 'fs'
import { resolvePath } from '../../exists'
import { inferNumberPlugin } from './infer-number'
import { commonFieldsPlugin } from './common-fields'
import { MetadataConfig } from '../../core-config'
import { fetchCoverPlugin } from './cover'
import { omitArtistsPlugin } from './omit-artists'

export type LocalJsonPlugin = (init: {
  cover?: Buffer
  config: MetadataConfig
}) => (context: {
  metadata: Metadata
  index: number
}) => void | Promise<void>

const plugins = [fetchCoverPlugin, omitArtistsPlugin, inferNumberPlugin, commonFieldsPlugin]
export class LocalJson extends MetadataSource {
  async normalize(metadatas: Metadata[], cover?: Buffer) {
    if (!metadatas || metadatas.length === 0) {
      return metadatas
    }
    const pluginInstances = plugins.map(p => p({ cover, config: this.config }))
    const results = await Promise.all(metadatas.map(async (metadata, index) => {
      for (const instance of pluginInstances) {
        await instance({
          metadata,
          index,
        })
      }
      return metadata
    }))
    return results
  }
  async resolveAlbumName(localSource: string) {
    return resolvePath(localSource)
  }
  async getMetadata(fullPath: string, cover?: Buffer) {
    const jsonMetadata = JSON.parse(readFileSync(fullPath, { encoding: 'utf8' })) as Metadata[]
    const metadata = await this.normalize(jsonMetadata, cover)
    return metadata
  }
}
export const localJson = new LocalJson()
