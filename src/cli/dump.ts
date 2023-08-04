import { Metadata } from '../core'
import { log } from '../core/debug'
import { cliOptions, metadataConfig } from './options'

const dumpCover = async (metadatas: Metadata[]) => {
  const { writeFileSync } = await import('fs')
  const { resolve } = await import('path')
  if (!cliOptions.cover) {
    return
  }
  const metadata = metadatas.find(m => m.coverImage)
  if (!metadata) {
    return
  }
  const { default: imageType } = await import('image-type')
  const type = imageType(metadata.coverImage)
  if (!type) {
    return
  }
  const coverFilename = resolve(process.cwd(), `cover.${type.ext}`)
  log('cover file', coverFilename)
  writeFileSync(coverFilename, metadata.coverImage)
}

export const dump = async () => {
  const { glob } = await import('glob')
  const { extname } = await import('path')
  const { writeFileSync, readFileSync } = await import('fs')
  const { readerMappings } = await import('../core/reader/reader-mappings')
  const globTypes = Object.keys(readerMappings)
    .map(readerType => readerType.replace(/^\./, ''))
    .join('|')
  const files = (await glob(`./**/*.@(${globTypes})`, { posix: true })).sort()
  log({ globTypes })
  log(files)
  if (files.length === 0) {
    console.log('没有找到能够提取的音乐文件')
    return
  }
  const results: { metadata: Metadata; rawTag: any }[] = await Promise.all(
    files.map(async file => {
      const type = extname(file)
      const reader = readerMappings[type]
      reader.config = metadataConfig
      const buffer = readFileSync(file)
      const rawTag = await reader.readRaw(buffer)
      const metadata = await reader.read(rawTag)
      return {
        rawTag,
        metadata,
      }
    }),
  )

  const metadatas = results.map(it => it.metadata)
  const rawTags = results.map(it => it.rawTag)
  writeFileSync(
    'metadata.json',
    JSON.stringify(
      metadatas.map(({ coverImage, ...restParts }) => {
        return restParts
      }),
      undefined,
      2,
    ),
  )
  if (cliOptions.debug) {
    writeFileSync(
      'metadata.debug.json',
      JSON.stringify(
        rawTags,
        (key, value) => {
          const shouldNotSerialized =
            typeof value === 'object' && value !== null && value.type === 'Buffer'
          if (shouldNotSerialized) {
            return `<Buffer length=${value.data?.length ?? 0}>`
          }
          return value
        },
        2,
      ),
    )
  }
  await dumpCover(metadatas)
}
