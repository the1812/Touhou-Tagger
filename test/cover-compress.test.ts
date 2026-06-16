import { readFile } from 'fs/promises'

import imageInfo from 'imageinfo'
import { describe, expect, test } from 'vitest'

import { compressImageByConfig } from '../src/core/writer/image-compress.js'
import { fixturePath, metadataConfig } from './helpers.js'

describe('cover compression', () => {
  test('compresses cover when size threshold is exceeded', async () => {
    const cover = await readFile(fixturePath('cover.jpg'))
    const compressed = await compressImageByConfig(
      Buffer.from(cover),
      metadataConfig({
        coverCompressSize: 0.1,
      }),
    )

    expect(compressed.length).toBeLessThan(cover.length)
    expect(imageInfo(compressed)?.width).toBe(2400)
    expect(imageInfo(compressed)?.height).toBe(2400)
  })

  test('compresses and resizes cover when resolution limit is configured', async () => {
    const cover = await readFile(fixturePath('cover.jpg'))
    const compressed = await compressImageByConfig(
      Buffer.from(cover),
      metadataConfig({
        coverCompressSize: 0.1,
        coverCompressResolution: 256,
      }),
    )
    const info = imageInfo(compressed)

    expect(compressed.length).toBeLessThan(cover.length)
    expect(info?.width).toBeLessThanOrEqual(256)
    expect(info?.height).toBeLessThanOrEqual(256)
  })
})
