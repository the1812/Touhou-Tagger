import { MetadataBlockHeader, MetadataBlockHeaderLength, MetadataBlockType } from './header'
import { MetadataBlock } from '.'
import { allocBufferAndWrite } from '../buffer-base'

export const DefaultVendorString = 'flac-tagger 1.0.0 20230626'
export type VorbisComment = string
export class VorbisCommentBlock extends MetadataBlock {
  header: MetadataBlockHeader
  vendorString: string
  commentList: VorbisComment[]

  constructor(
    initialValues: {
      header?: MetadataBlockHeader
      vendorString?: string
      commentList?: VorbisComment[]
    } = {},
  ) {
    super()
    const {
      header = new MetadataBlockHeader({
        type: MetadataBlockType.VorbisComment,
      }),
      vendorString = DefaultVendorString,
      commentList = [],
    } = initialValues
    this.header = header
    this.vendorString = vendorString
    this.commentList = commentList
  }

  static fromBuffer(buffer: Buffer) {
    let bufferIndex = 0

    const header = MetadataBlockHeader.fromBuffer(buffer)
    bufferIndex += header.length

    const vendorLength = buffer.readUintLE(bufferIndex, 4)
    bufferIndex += 4

    const vendorString = buffer.slice(bufferIndex, bufferIndex + vendorLength).toString()
    bufferIndex += vendorLength

    const list: VorbisComment[] = []
    const listLength = buffer.readUintLE(bufferIndex, 4)
    bufferIndex += 4

    for (let commentIndex = 0; commentIndex < listLength; commentIndex++) {
      const commentLength = buffer.readUintLE(bufferIndex, 4)
      bufferIndex += 4

      const comment = buffer.slice(bufferIndex, bufferIndex + commentLength).toString()
      bufferIndex += commentLength

      list.push(comment)
    }
    return new VorbisCommentBlock({
      header,
      vendorString,
      commentList: list,
    })
  }

  toBuffer() {
    const commentBuffer = Buffer.alloc(this.commentListLength)
    let commentBufferIndex = 0
    this.commentList.forEach(comment => {
      const length = Buffer.byteLength(comment)
      commentBuffer.writeUintLE(length, commentBufferIndex, 4)
      commentBufferIndex += 4
      commentBuffer.write(comment, commentBufferIndex)
      commentBufferIndex += length
    })
    const vendorStringBuffer = Buffer.from(this.vendorString)

    return Buffer.concat([
      this.header.toBuffer(),
      allocBufferAndWrite(4, b => b.writeUint32LE(vendorStringBuffer.length)),
      vendorStringBuffer,
      allocBufferAndWrite(4, b => b.writeUint32LE(this.commentList.length)),
      commentBuffer,
    ])
  }

  get commentListLength() {
    return this.commentList
      .map(it => Buffer.byteLength(it) + 4)
      .reduce((previous, current) => previous + current, 0)
  }

  get length() {
    return (
      MetadataBlockHeaderLength +
      4 +
      Buffer.byteLength(this.vendorString) +
      4 +
      this.commentListLength
    )
  }
}
