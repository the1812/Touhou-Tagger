import { BufferBase } from '../buffer-base'

export enum MetadataBlockType {
  StreamInfo = 0,
  Padding,
  Application,
  SeekTable,
  VorbisComment,
  CueSheet,
  Picture,
  Invalid = 127,
}
export const MetadataBlockHeaderLength = 4
export class MetadataBlockHeader extends BufferBase {
  isLast: boolean
  type: MetadataBlockType
  dataLength: number

  constructor(initialValues: { isLast: boolean; type: MetadataBlockType; dataLength: number }) {
    super()
    Object.assign(this, initialValues)
  }

  static fromBuffer(buffer: Buffer) {
    const lastAndType = buffer.readUint8()
    return new MetadataBlockHeader({
      isLast: (lastAndType & 0b10000000) === 1,
      type: (lastAndType & 0b01111111) as MetadataBlockType,
      dataLength: buffer.readUintBE(1, 3),
    })
  }

  toBuffer() {
    const buffer = Buffer.alloc(this.length)
    buffer.writeUint8(this.type + (this.isLast ? 0b10000000 : 0))
    buffer.writeUintBE(this.dataLength, 1, 3)
    return buffer
  }

  get length() {
    return MetadataBlockHeaderLength
  }
}
