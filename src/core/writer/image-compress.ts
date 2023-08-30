import type { ImagePool as ImagePoolType } from '@squoosh/lib'
import { cpus } from 'os'
import type { MetadataConfig } from '../core-config'

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
export const compressImage = async (buffer: Buffer | CompressedBuffer, resolution?: number) => {
  await initImagePool()
  if (buffer[CompressedData]) {
    return buffer[CompressedData] as Buffer
  }
  const { default: imageInfo } = await import('imageinfo')
  const info = imageInfo(buffer)
  const resize = (() => {
    if (!resolution) {
      return undefined
    }
    if (info.width > resolution) {
      return {
        width: resolution,
      }
    }
    if (info.height > resolution) {
      return {
        height: resolution,
      }
    }
    return undefined
  })()
  const image = imagePool.ingestImage(buffer)

  await image.preprocess({
    resize,
  })
  const result = await image.encode({
    mozjpeg: {
      quality: getQuality(buffer.length),
    },
  })
  const resultBuffer = Buffer.from(result.mozjpeg.binary) as CompressedBuffer
  buffer[CompressedData] = resultBuffer
  return resultBuffer
}
export const compressImageByConfig = async (
  buffer: Buffer | CompressedBuffer,
  config: MetadataConfig,
) => {
  if (config.coverCompressSize > 0 && buffer.length > config.coverCompressSize * 1024 * 1024) {
    return compressImage(buffer, config.coverCompressResolution)
  }
  return buffer
}
