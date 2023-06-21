import type NodeID3 from 'node-id3'
import { Metadata } from '../../metadata/metadata'
import { MetadataReader } from '../metadata-reader'

const languageCodeConvert = (code: string | undefined) => {
  const mapping = {
    jpn: 'ja',
    deu: 'de',
    zho: 'zh',
  }
  return code ? (mapping[code] || mapping.jpn) : mapping.jpn
}
export class Mp3Reader extends MetadataReader<NodeID3.Tags> {
  get allowParallel() {
    return true
  }
  async readRaw(input: string | Buffer) {
    const { readFileSync } = await import('fs')
    const id3 = await import('node-id3')
    const tag = id3.read(typeof input === 'string' ? readFileSync(input) : input)
    return tag
  }
  async read(input: string | Buffer | NodeID3.Tags) {
    const tag = (typeof input === 'string' || input instanceof Buffer)
      ? await this.readRaw(input)
      : input
    const { separator } = this.config
    const metadata: Metadata = {
      title: tag.title ?? '',
      artists: tag.artist?.split(separator) ?? [],
      album: tag.album ?? '',
      albumOrder: tag.albumOrder ?? '',
      discNumber: tag.partOfSet ?? '',
      trackNumber: tag.trackNumber ?? '',
      composers: tag.composer?.split(separator),
      genres: tag.genre?.split(separator),
      year: tag.year,
      lyricists: tag.textWriter?.split(separator),
      albumArtists: tag.performerInfo?.split(separator),
      comments: tag.comment?.text,
      lyric: tag.unsynchronisedLyrics?.text,
      lyricLanguage: tag.unsynchronisedLyrics ? languageCodeConvert(tag.unsynchronisedLyrics?.language) : undefined,
      coverImage: tag.image?.imageBuffer,
    }
    return metadata
  }
}
export const mp3Reader = new Mp3Reader()
