import { MetadataBlockType } from './header'
import { OtherMetadataBlock } from './other'
import { PictureBlock } from './picture'
import { VorbisCommentBlock } from './vorbis-comment'

export const parseBlock = (buffer: Buffer) => {
  const blockType = (buffer.readUint8() & 0b01111111) as MetadataBlockType
  switch (blockType) {
    case MetadataBlockType.VorbisComment:
      return VorbisCommentBlock.fromBuffer(buffer)
    case MetadataBlockType.Picture:
      return PictureBlock.fromBuffer(buffer)
    default:
      return OtherMetadataBlock.fromBuffer(buffer)
  }
}
