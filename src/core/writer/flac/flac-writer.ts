import { FlacTagMap, writeFlacTags } from 'flac-tagger'
import { MetadataWriter } from '../metadata-writer'
import { Metadata } from '../../metadata/metadata'

const getVorbisComments = (metadata: Metadata): FlacTagMap => {
  const tagMap: FlacTagMap = {
    artist: metadata.artists,
    title: metadata.title,
    album: metadata.album,
    albumSort: metadata.albumOrder,
    trackNumber: metadata.trackNumber,
    discNumber: metadata.discNumber,
  }
  if (metadata.composers) {
    tagMap.composer = metadata.composers
  }
  if (metadata.comments) {
    tagMap.comment = metadata.comments
  }
  if (metadata.lyric) {
    tagMap.lyric = metadata.lyric
  }
  if (metadata.lyricists) {
    tagMap.lyricist = metadata.lyricists
  }
  if (metadata.albumArtists) {
    tagMap.albumArtist = metadata.albumArtists
  }
  if (metadata.genres) {
    tagMap.genre = metadata.genres
  }
  if (metadata.year) {
    tagMap.date = metadata.year
  }
  return tagMap
}
export class FlacWriter extends MetadataWriter {
  async write(metadata: Metadata, filePath: string) {
    const coverBuffer = await (async () => {
      if (!metadata.coverImage) {
        return undefined
      }
      const { compressImageByConfig } = await import('../image-compress')
      return compressImageByConfig(metadata.coverImage, this.config)
    })()
    await writeFlacTags(
      {
        tagMap: getVorbisComments(metadata),
        picture: coverBuffer
          ? {
              description: metadata.album,
              buffer: coverBuffer,
            }
          : undefined,
      },
      filePath,
    )
  }
}
export const flacWriter = new FlacWriter()
