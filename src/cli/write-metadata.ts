import { Metadata } from '../core'
import { extname } from 'path'
import { metadataConfig, cliOptions } from './options'
import { writeFileSync } from 'fs'
import { log } from '../core/debug'

export const writeMetadata = async (metadata: Metadata[], targetFiles: string[]) => {
  const { writerMappings } = await import('../core/writer/writer-mappings')
  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i]
    log(file)
    const type = extname(file)
    const writer = writerMappings[type]
    writer.config = metadataConfig
    await writer.write(metadata[i], file)
    if (cliOptions.lyric && cliOptions['lyric-output'] === 'lrc' && metadata[i].lyric) {
      writeFileSync(file.substring(0, file.lastIndexOf(type)) + '.lrc', metadata[i].lyric)
    }
  }
  // FLAC 那个库放 Promise.all 里就只有最后一个会运行???
  // await Promise.all(targetFiles.map((file, index) => {
  //   log(file)
  //   const type = extname(file)
  //   return writerMappings[type].write(metadata[index], file)
  // }))
  const coverBuffer = metadata[0].coverImage
  if (cliOptions.cover && coverBuffer) {
    const imageType = await import('image-type')
    const type = imageType(coverBuffer)
    if (type !== null) {
      const coverFilename = `cover.${type.ext}`
      log(coverFilename)
      writeFileSync(coverFilename, coverBuffer)
    }
  }
}