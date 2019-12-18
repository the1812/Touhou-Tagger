export const MetadataSeparator = ', '
export interface LyricConfig {
  type: 'original' | 'translated' | 'mixed'
  output: 'metadata' | 'lrc'
}
export interface MetadataConfig {
  lyric?: LyricConfig
}