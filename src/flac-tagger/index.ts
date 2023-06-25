import { readFileSync } from 'fs'
import { FlacStream } from './stream'
import { MetadataBlockType } from './metadata-block/header'
import { VorbisCommentBlock } from './metadata-block/vorbis-comment'
import { PictureBlock } from './metadata-block/picture'

const test = () => {
  const buffer = readFileSync(
    'C:/Users/The18/Documents/Docs/Codes/Touhou-Tagger/test-files/06 白华.flac',
  )
  const stream = FlacStream.fromBuffer(buffer)
  console.log({
    length: stream.length,
    blocks: stream.metadataBlocks.length,
    frameDataLength: stream.frameData.length,
    comments: (
      stream.metadataBlocks.find(
        it => it.header.type === MetadataBlockType.VorbisComment,
      ) as VorbisCommentBlock
    )?.commentList,
    picture: stream.metadataBlocks.find(
      it => it.header.type === MetadataBlockType.Picture,
    ) as PictureBlock,
  })
}
test()
