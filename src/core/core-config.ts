export const DefaultMetadataSeparator = ' / '
export interface LyricConfig {
  type: 'original' | 'translated' | 'mixed'
  output: 'metadata' | 'lrc'
  time: boolean
  translationSeparator: string
  maxCacheSize: number
}
export interface MetadataConfig {
  lyric?: LyricConfig
  commentLanguage: string
  separator: string
  timeout: number
  retry: number
}