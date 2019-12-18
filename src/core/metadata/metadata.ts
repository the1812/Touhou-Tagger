export interface Metadata {
  // Track data
  title: string
  artists: string[]
  discNumber: string
  trackNumber: string
  composers?: string[]
  comments?: string
  lyricLanguage?: string
  lyric?: string
  lyricists?: string[]
  // Album data
  album: string
  albumArtists?: string[]
  genres?: string[]
  year?: string
  coverImage?: Buffer
}