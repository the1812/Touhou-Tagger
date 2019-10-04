import { MetadataWriter } from './metadata-writer'
import { Metadata } from '../metadata/metadata'
import * as flac from 'flac-metadata'
import { createReadStream, createWriteStream } from 'fs'
import { MetadataSeparator } from '../core-config'

const DefaultVendor = 'reference libFLAC 1.3.2 20170101'
const getVorbisComments = (metadata: Metadata): string[] => {
  const comments = [
    `ARTIST=${metadata.artists.join(MetadataSeparator)}`,
    `TITLE=${metadata.title}`,
    `ALBUM=${metadata.album}`,
    `TRACKNUMBER=${metadata.trackNumber}`,
    `DISCNUMBER=${metadata.discNumber}`,
  ]
  if (metadata.composers) {
    comments.push(`COMPOSER=${metadata.composers.join(MetadataSeparator)}`)
  }
  if (metadata.comments) {
    comments.push(`COMMENT=${metadata.comments}`)
  }
  if (metadata.lyric) {
    comments.push(`LYRICS=${metadata.lyric}`)
  }
  if (metadata.lyricists) {
    comments.push(`LYRICIST=${metadata.lyricists.join(MetadataSeparator)}`)
  }
  if (metadata.albumArtists) {
    comments.push(`ALBUMARTIST=${metadata.albumArtists.join(MetadataSeparator)}`)
  }
  if (metadata.genres) {
    comments.push(`GENRE=${metadata.genres.join(MetadataSeparator)}`)
  }
  if (metadata.year) {
    comments.push(`ORIGINALYEAR=${metadata.year}`)
  }
  return comments
}
export class FlacWriter extends MetadataWriter {
  async write(metadata: Metadata, filePath: string) {
    const flacProcessor = new flac.Processor()
    flacProcessor.on("postprocess", function (mdb: any) {
      if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
        mdb.remove()
        if (mdb.removed || mdb.isLast) {
          const mdbVorbis = flac.data.MetaDataBlockVorbisComment.create(mdb.isLast, DefaultVendor, getVorbisComments(metadata))
          this.push(mdbVorbis.publish())
        }
      }
      // if (mdb.type === flac.Processor.MDB_TYPE_PICTURE) {
      //   if (mdb.removed || mdb.isLast) {
      //     const mdbPicture = flac.data.MetaDataBlockPicture.create(mdb.isLast, 3 /* front cover */,
      //       )
      //     this.push(mdbPicture.publish())
      //   }
      // }
    })
    createReadStream(filePath).pipe(flacProcessor).pipe(createWriteStream(filePath))
  }
  async update(metadata: Metadata, filePath: string) {
    throw new Error('Method not implemented.')
  }
}