import { MetadataBlock } from '.'
import { MetadataBlockHeader } from './header'

export class OtherMetadataBlock extends MetadataBlock {
  header: MetadataBlockHeader
  data: Buffer

  constructor(initialValues: { header: MetadataBlockHeader; data: Buffer }) {
    super()
    Object.assign(this, initialValues)
  }

  static fromBuffer(buffer: Buffer) {
    const header = MetadataBlockHeader.fromBuffer(buffer)
    return new OtherMetadataBlock({
      header,
      data: buffer.slice(header.length, header.length + header.dataLength)
    })
  }

  toBuffer() {
    return Buffer.concat([this.header.toBuffer(), this.data])
  }

  get length() {
    return this.header.length + this.data.length
  }
}
