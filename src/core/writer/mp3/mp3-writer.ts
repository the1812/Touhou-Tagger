import { MetadataWriter } from '../metadata-writer'
import { Metadata } from '../../metadata/metadata'
import id3 from 'node-id3'

const CommentLanguage = 'zho'
const languageCodeConvert = (code: string | undefined) => {
  const mapping = {
    ja: 'jpn',
    de: 'deu',
    zh: 'zho'
  }
  return code ? (mapping[code] || 'jpn') : 'jpn'
}
const getNodeId3Tag = (metadata: Metadata, separator: string) => {
  const tag: id3.Tags = {
    title: metadata.title,
    artist: metadata.artists.join(separator),
    album: metadata.album,
    albumOrder: metadata.albumOrder,
    partOfSet: metadata.discNumber,
    trackNumber: metadata.trackNumber,
    composer: metadata.composers ? metadata.composers.join(separator) : '',
    genre: metadata.genres ? metadata.genres.join(separator) : '',
    year: metadata.year || '',
    textWriter: metadata.lyricists ? metadata.lyricists.join(separator) : '',
    performerInfo: metadata.albumArtists ? metadata.albumArtists.join(separator) : '',
    comment: {
      language: CommentLanguage,
      text: metadata.comments || '',
    },
    unsynchronisedLyrics: {
      language: languageCodeConvert(metadata.lyricLanguage),
      text: metadata.lyric || '',
    },
  }
  if (metadata.coverImage) {
    tag.image = {
      type: {
        id: 3,
        name: 'front cover'
      },
      description: metadata.album,
      imageBuffer: metadata.coverImage,
    }
  }
  return tag
}
export class Mp3Writer extends MetadataWriter {
  async write(metadata: Metadata, filePath: string) {
    const tag = getNodeId3Tag(metadata, this.config.separator)
    if (this.config.lyric && this.config.lyric.output === 'lrc') {
      tag.unsynchronisedLyrics.text = ''
      tag.unsynchronisedLyrics.language = undefined
    }
    const result = id3.write(tag, filePath)
    if (result !== true) {
      throw new Error(`Write operation failed. filePath = ${filePath}`)
    }
  }
  // async update(metadata: Metadata, filePath: string) {
  //   const result = id3.update(getNodeId3Tag(metadata), filePath)
  //   if (result === false) {
  //     throw new Error(`Update operation failed. filePath = ${filePath}`)
  //   }
  // }
}
export const mp3Writer = new Mp3Writer()