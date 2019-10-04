import { MetadataWriter } from './metadata-writer'
import { Metadata } from '../metadata/metadata'
import * as id3 from 'node-id3'
import { MetadataSeparator } from '../core-config'

const getNodeId3Tag = (metadata: Metadata) => {
  const tag: id3.NodeID3Tag = {
    title: metadata.title,
    artist: metadata.artists.join(MetadataSeparator),
    album: metadata.album,
    partOfSet: metadata.discNumber,
    trackNumber: metadata.trackNumber,
    composer: metadata.composers ? metadata.composers.join(MetadataSeparator) : '',
    genre: metadata.genres ? metadata.genres.join(MetadataSeparator) : '',
    year: metadata.year || '',
    textWriter: metadata.lyricists ? metadata.lyricists.join(MetadataSeparator) : '',
    performerInfo: metadata.albumArtists ? metadata.albumArtists.join(MetadataSeparator) : '',
    comment: {
      text: metadata.comments || '',
    },
    unsynchronisedLyrics: {
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
    const result = id3.write(getNodeId3Tag(metadata), filePath)
    if (result === false) {
      throw new Error(`Write operation failed. filePath = ${filePath}`)
    }
  }
  async update(metadata: Metadata, filePath: string) {
    const result = id3.update(getNodeId3Tag(metadata), filePath)
    if (result === false) {
      throw new Error(`Update operation failed. filePath = ${filePath}`)
    }
  }
}
export const mp3Writer = new Mp3Writer()