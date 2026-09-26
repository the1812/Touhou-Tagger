import { readdir, rename, writeFile } from 'fs/promises'
import { extname, resolve as resolvePath } from 'path'

import type { Ora } from 'ora'

import type { MetadataConfig } from '../core/core-config.js'
import { log } from '../core/debug.js'
import type { Metadata } from '../core/metadata/metadata.js'
import { asyncFlatMap } from './helper.js'
import type { CliOptions } from './options.js'

const leadingNumberSort = (a: string, b: string) => {
  const infinityPrase = (str: string) => {
    const number = parseInt(str)
    if (Number.isNaN(number)) {
      return Infinity
    }
    return number
  }
  const intA = infinityPrase(a)
  const intB = infinityPrase(b)
  const intCompare = intA - intB
  if (intCompare === 0) {
    return a.localeCompare(b)
  }
  return intCompare
}

export async function createFiles(metadata: Metadata[], workingDir: string, spinner: Ora) {
  const { dirname } = await import('path')
  const { writerMappings } = await import('../core/writer/writer-mappings.js')
  const fileTypes = Object.keys(writerMappings)
  const fileTypeFilter = (file: string) => fileTypes.some(type => file.endsWith(type))
  const dir = (await readdir(workingDir)).sort(leadingNumberSort)
  const discFiles = (
    await asyncFlatMap(
      dir.filter(f => f.match(/^Disc (\d+)/)),
      async f => {
        return (await readdir(resolvePath(workingDir, f)))
          .sort(leadingNumberSort)
          .map(inner => `${f}/${inner}`)
      },
    )
  ).filter(fileTypeFilter)
  const files = dir
    .filter(fileTypeFilter)
    .concat(discFiles)
    .slice(0, metadata.length)
    .map(f => resolvePath(workingDir, f))
  if (files.length === 0) {
    const message = '未找到任何支持的音乐文件.'
    spinner.fail(message)
    throw new Error(message)
  }
  const targetFiles = files.map((file, index) => {
    const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2)
    const filename = `${metadata[index].trackNumber.padStart(maxLength, '0')} ${
      metadata[index].title
    }${extname(file)}`.replace(/[/\\:*?"<>|]/g, '')
    return resolvePath(dirname(file), filename)
  })
  log(files, targetFiles)
  await Promise.all(
    files.map((file, index) => {
      return rename(file, targetFiles[index])
    }),
  )
  return targetFiles
}

export async function writeMetadataToFile(
  metadata: Metadata[],
  targetFiles: string[],
  workingDir: string,
  metadataConfig: MetadataConfig,
  options: Pick<CliOptions, 'lyric' | 'lyric-output' | 'cover'>,
) {
  const { writerMappings } = await import('../core/writer/writer-mappings.js')
  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i]
    log(file)
    const type = extname(file)
    const writer = writerMappings[type]
    writer.config = metadataConfig
    await writer.write(metadata[i], file)
    const { lyric } = metadata[i]
    if (options.lyric && options['lyric-output'] === 'lrc' && lyric) {
      await writeFile(`${file.substring(0, file.lastIndexOf(type))}.lrc`, lyric)
    }
  }
  // FLAC 那个库放 Promise.all 里就只有最后一个会运行???
  // await Promise.all(targetFiles.map((file, index) => {
  //   log(file)
  //   const type = extname(file)
  //   return writerMappings[type].write(metadata[index], file)
  // }))
  const coverBuffer = metadata[0].coverImage
  if (options.cover && coverBuffer) {
    const { default: imageType } = await import('image-type')
    const type = imageType(coverBuffer)
    if (type !== null) {
      const coverFilename = resolvePath(workingDir, `cover.${type.ext}`)
      log('cover file', coverFilename)
      await writeFile(coverFilename, coverBuffer)
    }
  }
}
