import type { ImagePool as ImagePoolType } from '@squoosh/lib'
import { cpus } from 'os'

const getQuality = (size: number) => Math.round(92.647 - 1.683e-6 * size)
const CompressedData = Symbol('CompressedData')

let imagePool: ImagePoolType
const initImagePool = async () => {
  if (imagePool) {
    return
  }
  const { ImagePool } = await import('@squoosh/lib')
  imagePool = new ImagePool(cpus().length)
}

export type CompressedBuffer = Buffer & {
  [CompressedData]: Buffer
}
export const compressImage = async (buffer: Buffer | CompressedBuffer) => {
  await initImagePool()
  if (buffer[CompressedData]) {
    return buffer[CompressedData]
  }
  const image = imagePool.ingestImage(buffer)
  await image.preprocess()
  const result = await image.encode({
    mozjpeg: {
      quality: getQuality(buffer.length),
    },
  })
  const resultBuffer = Buffer.from(result.mozjpeg.binary) as CompressedBuffer
  buffer[CompressedData] = resultBuffer
  return resultBuffer
}
