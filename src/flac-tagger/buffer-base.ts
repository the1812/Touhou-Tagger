export abstract class BufferBase {
  abstract toBuffer(): Buffer
  abstract get length(): number
}

export const allocBufferAndWrite = (size: number, onWrite: (buffer: Buffer) => void) => {
  const buffer = Buffer.alloc(size)
  onWrite(buffer)
  return buffer
}
