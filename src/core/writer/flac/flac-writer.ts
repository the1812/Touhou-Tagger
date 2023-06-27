import { MetadataWriter } from '../metadata-writer'
import { Metadata } from '../../metadata/metadata'
import { writeFlacTags } from '../../../flac-tagger'

const getMultipleComments = (name: string, data: string[]) => {
  if (typeof data === 'string') {
    return [`${name}=${data}`]
  }
  return data.map(value => `${name}=${value}`)
}
const getVorbisComments = (metadata: Metadata): string[] => {
  const comments = [
    ...getMultipleComments('ARTIST', metadata.artists),
    `TITLE=${metadata.title}`,
    `ALBUM=${metadata.album}`,
    `ALBUMSORT=${metadata.albumOrder}`,
    `TRACKNUMBER=${metadata.trackNumber}`,
    `DISCNUMBER=${metadata.discNumber}`,
  ]
  if (metadata.composers) {
    comments.push(...getMultipleComments('COMPOSER', metadata.composers))
  }
  if (metadata.comments) {
    comments.push(`COMMENT=${metadata.comments}`)
  }
  if (metadata.lyric) {
    comments.push(`LYRICS=${metadata.lyric}`)
  }
  if (metadata.lyricists) {
    comments.push(...getMultipleComments('LYRICIST', metadata.lyricists))
  }
  if (metadata.albumArtists) {
    comments.push(...getMultipleComments('ALBUMARTIST', metadata.albumArtists))
  }
  if (metadata.genres) {
    comments.push(...getMultipleComments('GENRE', metadata.genres))
  }
  if (metadata.year) {
    comments.push(`DATE=${metadata.year}`)
  }
  return comments
}
export class FlacWriter extends MetadataWriter {
  async write(metadata: Metadata, filePath: string) {
    writeFlacTags(
      {
        vorbisComments: getVorbisComments(metadata),
        picture: metadata.coverImage
          ? {
              description: metadata.album,
              buffer: metadata.coverImage,
            }
          : undefined,
      },
      filePath,
    )
  }
}
export const flacWriter = new FlacWriter()
