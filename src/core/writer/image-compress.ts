import { cpus } from 'os'

import type { ImagePool as ImagePoolType } from '@squoosh/lib'

import type { MetadataConfig } from '../core-config.js'

const getQuality = (size: number) => Math.round(92.647 - 1.683e-6 * size)
const CompressedData = Symbol('CompressedData')

let imagePool: Promise<ImagePoolType> | undefined
const getImagePool = () => {
  imagePool ??= (async () => {
    const { ImagePool } = await import('@squoosh/lib')
    return new ImagePool(cpus().length)
  })()
  return imagePool
}

export type CompressedBuffer = Buffer & {
  [CompressedData]?: Promise<Buffer>
}
export const compressImage = async (buffer: Buffer | CompressedBuffer, resolution?: number) => {
  const cached = buffer as CompressedBuffer
  if (!cached[CompressedData]) {
    cached[CompressedData] = (async () => {
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
      const pool = await getImagePool()
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
  return cached[CompressedData]
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
