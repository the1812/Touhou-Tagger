export const MetadataSeparator = ', '
export interface LyricConfig {
  type: 'original' | 'translated' | 'mixed'
  output: 'metadata' | 'lrc'
  time: boolean
}
export interface MetadataConfig {
  lyric?: LyricConfig
}