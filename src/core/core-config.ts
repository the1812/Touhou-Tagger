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
  coverCompressSize: number
  coverCompressResolution: number
  separator: string
  timeout: number
  retry: number
}
