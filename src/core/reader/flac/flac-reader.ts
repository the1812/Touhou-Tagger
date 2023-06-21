import flac from 'flac-metadata'
import { Metadata } from '../../metadata/metadata'
import { MetadataReader } from '../metadata-reader'
import { log } from '../../debug'

export interface FlacReaderResult {
  vorbisComments: string[]
  picture?: Buffer
}
export class FlacReader extends MetadataReader<FlacReaderResult> {
  get allowParallel() {
    return false
  }
  async readRaw(input: string | Buffer) {
    const { createReadStream } = await import('fs')
    const { Readable, finished } = await import('stream')
    const { promisify } = await import('util')
    const processor = new flac.Processor({ parseMetaDataBlocks: true })
    const reader = (() => {
      if (typeof input === 'string') {
        return createReadStream(input)
      }
      return Readable.from(input)
    })()
    const comments: string[] = []
    let picture: Buffer
    processor.on('postprocess', function (mdb: any) {
      if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
        comments.push(...mdb.comments)
      }
      if (mdb.type === flac.Processor.MDB_TYPE_PICTURE) {
        picture = mdb.pictureData
      }
    })
    reader.on('end', () => {
      console.log('end')
    })
    processor.on('finish', () => {
      console.log('finish')
    })
    reader.pipe(processor)
    await promisify(finished)(processor)
    log({ comments })
    return {
      vorbisComments: comments,
      picture,
    }
  }
  async read(input: string | Buffer | FlacReaderResult) {
    const tag = (typeof input === 'string' || input instanceof Buffer)
      ? await this.readRaw(input)
      : input
    const { vorbisComments, picture } = tag
    const readVorbisComments = ((name: string, asList?: boolean) => {
      const comments = vorbisComments.filter(c => c.startsWith(`${name.toUpperCase()}=`)).map(c => c.replace(new RegExp(`^${name.toUpperCase()}=`), ''))
      if (asList) {
        return comments
      }
      return comments[0] ?? ''
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
      coverImage: picture,
    }
    return metadata
  }
}
export const flacReader = new FlacReader()
