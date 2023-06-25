import { BufferBase } from './buffer-base'
import { MetadataBlock } from './metadata-block'
import { MetadataBlockType } from './metadata-block/header'
import { parseBlock } from './metadata-block/parse'

const FlacStreamMarker = 'fLaC'
// spec: https://xiph.org/flac/format.html
export class FlacStream extends BufferBase {
  metadataBlocks: MetadataBlock[]
  frameData: Buffer

  constructor(initialValues: { metadataBlocks: MetadataBlock[]; frameData: Buffer }) {
    super()
    Object.assign(this, initialValues)
  }

  static fromBuffer(buffer: Buffer) {
    const marker = buffer.slice(0, 4).toString()
    if (marker !== FlacStreamMarker) {
      throw new Error('Invalid stream header')
    }
    let bufferIndex = 4
    const blocks: MetadataBlock[] = []
    const isNotLastBlock = () => blocks.length > 0 ? !(blocks[blocks.length - 1].header.isLast) : true
    while (isNotLastBlock()) {
      const restBlock = buffer.slice(bufferIndex)
      const block = parseBlock(restBlock)
      if (block.header.type === MetadataBlockType.Invalid) {
        break
      }
      blocks.push(block)
      bufferIndex += block.length
    }
    return new FlacStream({
      metadataBlocks: blocks,
      frameData: buffer.slice(bufferIndex),
    })
  }

  toBuffer() {
    return Buffer.concat([
      Buffer.from(FlacStreamMarker),
      ...this.metadataBlocks.map(b => b.toBuffer()),
      this.frameData,
    ])
  }

  get length() {
    return this.metadataBlocks.map(it => it.length).reduce((previous, current) => previous + current, 0)
      + this.frameData.length
  }
}