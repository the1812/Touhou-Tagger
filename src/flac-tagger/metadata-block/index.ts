import { BufferBase } from '../buffer-base'
import type { MetadataBlockHeader } from './header'

export abstract class MetadataBlock extends BufferBase {
  abstract header: MetadataBlockHeader
  get type() {
    return this.header.type
  }
}
