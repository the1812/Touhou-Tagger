import { log } from '../core/debug.js'
import { Metadata } from '../core/index.js'
import { simplifyMetadataInfo } from '../core/metadata/normalize/normalize.js'
import { CliCommandBase } from './command-base.js'
import { getMetadataConfig } from './options.js'

const handleBufferStringify = (key: string, value: unknown) => {
  const buffer = value as { type?: string; data?: number[] } | null
  if (buffer?.type === 'Buffer') {
    return `<Buffer length=${String(buffer.data?.length ?? 0)}>`
  }
  return value
}
const dumpCover = async (metadatas: Metadata[]) => {
  const { writeFileSync } = await import('fs')
  const { resolve } = await import('path')
  const metadata = metadatas.find(m => m.coverImage)
  const cover = metadata?.coverImage
  if (!cover) {
    return
  }
  const { default: imageType } = await import('image-type')
  const type = imageType(cover)
  if (!type) {
    return
  }
  const coverFilename = resolve(process.cwd(), `cover.${type.ext}`)
  log('cover file', coverFilename)
  writeFileSync(coverFilename, cover)
}

export class CliDumper extends CliCommandBase {
  async run() {
    await this.loadAlbumOptions()
    const { glob } = await import('glob')
    const { extname, resolve } = await import('path')
    const { writeFileSync, readFileSync } = await import('fs')
    const { readerMappings } = await import('../core/reader/reader-mappings.js')
    const globTypes = Object.keys(readerMappings)
      .map(readerType => readerType.replace(/^\./, ''))
      .join('|')
    const files = (
      await glob(`./**/*.@(${globTypes})`, { posix: true, cwd: this.workingDir })
    ).sort()
    log({ globTypes })
    log(files)
    if (files.length === 0) {
      console.log('没有找到能够提取的音乐文件')
      return
    }
    const results: { metadata: Metadata; rawTag: unknown }[] = await Promise.all(
      files.map(async file => {
        const type = extname(file)
        const reader = readerMappings[type]
        reader.config = getMetadataConfig(this.options)
        const buffer = readFileSync(resolve(this.workingDir, file))
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
    await simplifyMetadataInfo({
      metadatas,
    })
    writeFileSync(
      resolve(this.workingDir, 'metadata.json'),
      JSON.stringify(
        metadatas.map(({ coverImage, ...restParts }) => {
          return restParts
        }),
        undefined,
        2,
      ),
    )
    if (this.options.debug) {
      writeFileSync(
        resolve(this.workingDir, 'metadata.debug.json'),
        JSON.stringify(rawTags, handleBufferStringify, 2),
      )
    }
    if (this.options.cover) {
      await dumpCover(metadatas)
    }
  }
}
