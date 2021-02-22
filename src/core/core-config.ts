export const DefaultMetadataSeparator = ' / '
export interface LyricConfig {
  type: 'original' | 'translated' | 'mixed'
  output: 'metadata' | 'lrc'
  time: boolean
  translationSeparator: string
}
export interface MetadataConfig {
  lyric?: LyricConfig
  separator: string
}