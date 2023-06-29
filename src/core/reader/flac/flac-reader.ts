import { Metadata } from '../../metadata/metadata'
import { MetadataReader } from '../metadata-reader'
import { FlacTags, readFlacTags } from 'flac-tagger'

export class FlacReader extends MetadataReader<FlacTags> {
  async readRaw(input: string | Buffer) {
    return readFlacTags(input)
  }
  async read(input: string | Buffer | FlacTags) {
    const tag =
      typeof input === 'string' || input instanceof Buffer ? await this.readRaw(input) : input
    const { tagMap, picture } = tag
    const readVorbisComments = ((name: string, asList?: boolean) => {
      const comments = tagMap[name]
      if (asList) {
        if (Array.isArray(comments)) {
          return comments.length === 0 ? undefined : comments
        }
        return comments ? [comments] : undefined
      }
      if (Array.isArray(comments)) {
        return comments[0]
      }
      return comments || undefined
    }) as {
      (name: string, asList?: undefined | false): string
      (name: string, asList: true): string[]
    }
    const metadata: Metadata = {
      title: readVorbisComments('title'),
      artists: readVorbisComments('artist', true),
      album: readVorbisComments('album'),
      albumOrder: readVorbisComments('albumSort'),
      discNumber: readVorbisComments('discNumber'),
      trackNumber: readVorbisComments('trackNumber'),
      composers: readVorbisComments('composer', true),
      genres: readVorbisComments('genre', true),
      year: readVorbisComments('date'),
      lyricists: readVorbisComments('lyricist', true),
      albumArtists: readVorbisComments('albumArtist', true),
      comments: readVorbisComments('comment'),
      lyric: readVorbisComments('lyrics'),
      coverImage: picture.buffer,
    }
    return metadata
  }
}
export const flacReader = new FlacReader()
