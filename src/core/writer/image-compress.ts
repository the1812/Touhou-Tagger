import type { ImagePool as ImagePoolType } from '@squoosh/lib'
import { cpus } from 'os'
import type { MetadataConfig } from '../core-config'

const getQuality = (size: number) => Math.round(92.647 - 1.683e-6 * size)
const CompressedData = Symbol('CompressedData')

let imagePool: Promise<ImagePoolType>
const initImagePool = async () => {
  if (imagePool) {
    return
  }
  imagePool = (async () => {
    const { ImagePool } = await import('@squoosh/lib')
    return new ImagePool(cpus().length)
  })()
}

export type CompressedBuffer = Buffer & {
  [CompressedData]: Promise<Buffer>
}
export const compressImage = async (buffer: Buffer | CompressedBuffer, resolution?: number) => {
  await initImagePool()
  if (!buffer[CompressedData]) {
    buffer[CompressedData] = (async () => {
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
      const pool = await imagePool
      const image = pool.ingestImage(buffer)

      await image.preprocess(
        resize
          ? {
              resize,
            }
          : undefined,
      )
      const result = await image.encode({
        mozjpeg: {
          quality: getQuality(buffer.length),
        },
      })
      const resultBuffer = Buffer.from(result.mozjpeg.binary) as CompressedBuffer
      return resultBuffer
    })()
  }
  return (buffer as CompressedBuffer)[CompressedData]
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
