import { cliOptions, metadataConfig } from './options'

export const downloadMetadata = async (album: string) => {
  const { sourceMappings } = await import(`../core/metadata/source-mappings`)
  const metadataSource = sourceMappings[cliOptions.source]
  metadataSource.config = metadataConfig
  return await metadataSource.getMetadata(album)
}