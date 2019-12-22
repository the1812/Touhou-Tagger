import { MetadataWriter } from './metadata-writer'
import { Metadata } from '../metadata/metadata'
import * as flac from 'flac-metadata'
import imageinfo = require('imageinfo')
import { createWriteStream, readFileSync } from 'fs'
import { MetadataSeparator } from '../core-config'
import { Readable, finished } from 'stream'
import { promisify } from 'util'

const DefaultVendor = 'reference libFLAC 1.3.2 20170101'
const getVorbisComments = (metadata: Metadata): string[] => {
  const comments = [
    `ARTIST=${metadata.artists.join(MetadataSeparator)}`,
    `TITLE=${metadata.title}`,
    `ALBUM=${metadata.album}`,
    `ALBUMSORT=${metadata.albumOrder}`,
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
    comments.push(`DATE=${metadata.year}`)
  }
  return comments
}
export class FlacWriter extends MetadataWriter {
  async write(metadata: Metadata, filePath: string) {
    const commentsProcessor = new flac.Processor({ parseMetaDataBlocks: true })
    const pictureProcessor = new flac.Processor({ parseMetaDataBlocks: true })
    const lyricConfig = this.config.lyric
    commentsProcessor.on('preprocess', function (mdb: any) {
      if (!mdb.isLast) {
        if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
          mdb.remove()
        }
      } else {
        let vorbisComments = getVorbisComments(metadata)
        if (lyricConfig && lyricConfig.output === 'lrc') {
          vorbisComments = vorbisComments.filter(c => !c.startsWith('LYRICS='))
        }
        const mdbVorbis = flac.data.MetaDataBlockVorbisComment.create(
          !metadata.coverImage,
          DefaultVendor,
          vorbisComments)
        this.push(mdbVorbis.publish())
      }
    })
    pictureProcessor.on('preprocess', function (mdb: any) {
      if (!mdb.isLast) {
        if (mdb.type === flac.Processor.MDB_TYPE_PICTURE) {
          mdb.remove()
        }
      } else if (metadata.coverImage) {
        const info = imageinfo(metadata.coverImage)
        const mdbPicture = flac.data.MetaDataBlockPicture.create(
          !!metadata.coverImage,
          3 /* front cover */,
          info.mimeType,
          metadata.album,
          info.width,
          info.height,
          24, /* bits per pixel: unknown */
          0, /* colors: unknown */
          metadata.coverImage
        )
        this.push(mdbPicture.publish())
      }
    }
    )
    const fileBuffer = readFileSync(filePath)
    const reader = new Readable({
      read() {
        this.push(fileBuffer)
        this.push(null)
      }
    })
    const writer = createWriteStream(filePath)
    reader.pipe(commentsProcessor).pipe(pictureProcessor).pipe(writer)
    await promisify(finished)(writer)
  }
}
export const flacWriter = new FlacWriter()
