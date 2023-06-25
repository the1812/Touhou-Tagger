export abstract class BufferBase {
  abstract toBuffer(): Buffer
  abstract get length(): number
}
