export interface AlbumMetadata {
  album: string
  albumOrder: string
  albumArtists?: string[]
  genres?: string[]
  year?: string
  coverImage?: Buffer
  extraData?: Record<string, unknown>
}
export interface Metadata extends AlbumMetadata {
  title: string
  artists: string[]
  discNumber: string
  trackNumber: string
  composers?: string[]
  comments?: string
  lyricLanguage?: string
  lyric?: string
  lyricists?: string[]
}
