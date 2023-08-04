/* eslint-disable @typescript-eslint/naming-convention */
export interface NodeID3Tag {
  title: string
  artist: string
  album: string
  partOfSet: string
  trackNumber: string
  composer: string
  genre: string
  year: string
  textWriter: string
  performerInfo: string
  comment: {
    text: string
  }
  unsynchronisedLyrics: {
    language?: string
    text: string
  }
  image?: {
    type: {
      id: number
      name: string
    }
    description: string
    imageBuffer: Buffer
  }
  TSOA?: string
  albumOrder?: string
  raw?: { [name: string]: any }
}
export function write(tag: NodeID3Tag, file: string): boolean
export function update(tag: NodeID3Tag, file: string): boolean
export function read(file: string): NodeID3Tag
