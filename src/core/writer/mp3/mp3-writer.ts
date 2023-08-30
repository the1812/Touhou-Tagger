import id3 from 'node-id3'
import { MetadataWriter } from '../metadata-writer'
import { Metadata } from '../../metadata/metadata'
import { log } from '../../debug'

const languageCodeConvert = (code: string | undefined) => {
  const mapping = {
    ja: 'jpn',
    de: 'deu',
    zh: 'zho',
  }
  return code ? mapping[code] || mapping.ja : mapping.ja
}
export class Mp3Writer extends MetadataWriter {
  private getNodeId3Tag(metadata: Metadata, separator: string) {
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
        language: this.config.commentLanguage,
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
          name: 'front cover',
        },
        description: '', // 必须留空, 否则 iTunes 不识别封面
        imageBuffer: metadata.coverImage,
      }
    }
    return tag
  }

  async write(metadata: Metadata, filePath: string) {
    const tag = this.getNodeId3Tag(metadata, this.config.separator)
    if (this.config.lyric && this.config.lyric.output === 'lrc') {
      tag.unsynchronisedLyrics.text = ''
      tag.unsynchronisedLyrics.language = undefined
    }
    log(
      this.config.coverCompressSize,
      this.config.coverCompressSize * 1024 * 1024,
      tag.image?.imageBuffer?.length,
    )
    if (tag.image?.imageBuffer) {
      const { compressImageByConfig } = await import('../image-compress')
      tag.image.imageBuffer = await compressImageByConfig(tag.image.imageBuffer, this.config)
    }
    const result = id3.write(tag, filePath)
    if (result !== true) {
      throw new Error(`Write operation failed. filePath = ${filePath}`)
    }
  }
}
export const mp3Writer = new Mp3Writer()
