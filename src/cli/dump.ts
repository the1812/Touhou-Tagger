import { metadataConfig } from './options'

export const dump = async () => {
  const { glob } = await import('glob')
  const { extname } = await import('path')
  const { writeFileSync } = await import('fs')
  const { log } = await import('../core/debug')
  const { readerMappings } = await import('../core/reader/reader-mappings')
  const globTypes = Object.keys(readerMappings).map(readerType => readerType.replace(/^\./, '')).join('|')
  const files = (await glob(`./**/*.@(${globTypes})`, { posix: true })).sort()
  log({ globTypes })
  log(files)
  const metadatas = await Promise.all(files.map(async file => {
    const type = extname(file)
    const reader = readerMappings[type]
    reader.config = metadataConfig
    const metadata = await reader.read(file)
    return metadata
  }))
  if (metadatas.length === 0) {
    console.log('没有找到能够提取的音乐文件')
    return
  }
  writeFileSync('metadata.json', JSON.stringify(metadatas.map(m => {
    const { coverImage, ...restParts } = m
    return restParts
  }), undefined, 2))
}
