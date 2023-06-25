import { VorbisComment } from './metadata-block/vorbis-comment'
import { PictureType } from './metadata-block/picture'
import { readFileSync } from 'fs'
import { FlacStream } from './stream'

export interface FlacTags {
  vorbisComments: VorbisComment[]
  picture?: {
    pictureType?: PictureType
    mime?: string
    description?: string
    colorDepth?: number
    colors?: number
    buffer: Buffer
  }
}
export { FlacStream } from './stream'
export { BufferBase } from './buffer-base'
export { MetadataBlockType, MetadataBlockHeaderLength, MetadataBlockHeader } from './metadata-block/header'
export { MetadataBlock } from './metadata-block'
export { OtherMetadataBlock } from './metadata-block/other'
export { PictureBlock, PictureType } from './metadata-block/picture'
export { VorbisComment, VorbisCommentBlock } from './metadata-block/vorbis-comment'

export const readFlacTags = (input: string | Buffer) => {
  let buffer: Buffer
  if (typeof input === 'string') {
    buffer = readFileSync(input)
  } else {
    buffer = input
  }

  const stream = FlacStream.fromBuffer(buffer)
  const { vorbisCommentBlock, pictureBlock } = stream
  const tags: FlacTags = {
    vorbisComments: vorbisCommentBlock?.commentList ?? [],
    picture: pictureBlock ? ({
      pictureType: pictureBlock.pictureType,
      mime: pictureBlock.mime,
      description: pictureBlock.description,
      colorDepth: pictureBlock.colorDepth,
      colors: pictureBlock.colors,
      buffer: pictureBlock.pictureBuffer,
    }) : undefined,
  }
  return tags
}
