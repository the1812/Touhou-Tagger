declare module 'node-id3' {
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
  }
  export function write(tag: NodeID3Tag, file: string): boolean
  export function update(tag: NodeID3Tag, file: string): boolean
  export function read(file: string): NodeID3Tag
}