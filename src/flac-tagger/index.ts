import { VorbisComment, VorbisCommentBlock } from './metadata-block/vorbis-comment'
import { PictureBlock, PictureType } from './metadata-block/picture'
import { readFileSync, writeFileSync } from 'fs'
import { FlacStream } from './stream'
import { MetadataBlockHeader, MetadataBlockHeaderLength, MetadataBlockType } from './metadata-block/header'
import { OtherMetadataBlock } from './metadata-block/other'

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

export const writeFlacTags = (tags: FlacTags, filePath: string) => {
  const buffer = readFileSync(filePath)
  const stream = FlacStream.fromBuffer(buffer)
  const originalLength = stream.length

  if (stream.vorbisCommentBlock) {
    stream.vorbisCommentBlock.commentList = tags.vorbisComments
  } else {
    stream.metadataBlocks.push(new VorbisCommentBlock({
      commentList: tags.vorbisComments
    }))
  }

  if (tags.picture) {
    const { pictureBlock } = stream
    if (pictureBlock) {
      stream.metadataBlocks = stream.metadataBlocks.filter(b => b !== pictureBlock)
    }

    stream.metadataBlocks.push(new PictureBlock({
      pictureBuffer: tags.picture.buffer,
      mime: tags.picture.mime,
      description: tags.picture.description,
      colorDepth: tags.picture.colorDepth,
      colors: tags.picture.colors,
    }))
  }

  if (stream.metadataBlocks.some(b => b.type === MetadataBlockType.Padding)) {
    stream.metadataBlocks = stream.metadataBlocks.filter(b => b.type !== MetadataBlockType.Padding)
    const paddingLength = originalLength - stream.length
    if (paddingLength - MetadataBlockHeaderLength > 0) {
      stream.metadataBlocks.push(new OtherMetadataBlock({
        header: new MetadataBlockHeader({
          type: MetadataBlockType.Padding,
        }),
        data: Buffer.alloc(paddingLength - MetadataBlockHeaderLength),
      }))
    }
  }

  writeFileSync(filePath, stream.toBuffer())
}

const tags = readFlacTags('C:/Users/The18/Documents/Docs/Codes/Touhou-Tagger/test-files/06 白华.flac')
console.log({ tags })
writeFlacTags(tags, 'C:/Users/The18/Documents/Docs/Codes/Touhou-Tagger/test-files/06 白华 - 副本2.flac')
