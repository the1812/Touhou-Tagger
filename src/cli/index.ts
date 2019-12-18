#!/usr/bin/env node
import * as readline from 'readline'
import { basename, extname } from 'path'
import { writeFileSync } from 'fs'
import * as commandLineArgs from 'command-line-args'
import { LyricConfig, MetadataConfig } from '../core/core-config'
import { Metadata, writerMappings } from '../core'
import { log, setDebug } from '../core/debug'

const cliOptions = commandLineArgs([
  { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
  { name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
  { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' },
  { name: 'lyric', alias: 'l', type: Boolean, defaultValue: false },
  { name: 'lyric-type', alias: 't', type: String, defaultValue: 'original' },
  { name: 'lyric-output', alias: 'o', type: String, defaultValue: 'metadata' },
]) as {
  cover: boolean
  debug: boolean
  source: string
  lyric: boolean
  'lyric-type': string
  'lyric-output': string
}
setDebug(cliOptions.debug)
const metadataConfig: MetadataConfig = {
  lyric: cliOptions.lyric ? {
    type: cliOptions['lyric-type'],
    output: cliOptions['lyric-output'],
  } as LyricConfig : undefined
}
log(cliOptions, metadataConfig)

const downloadMetadata = async (album: string) => {
  const { sourceMappings } = await import(`../core/metadata/source-mappings`)
  const metadataSource = sourceMappings[cliOptions.source]
  metadataSource.config = metadataConfig
  return await metadataSource.getMetadata(album)
}
const createFiles = async (metadata: Metadata[]) => {
  const { readdirSync, renameSync } = await import('fs')
  const { dirname } = await import('path')
  const { writerMappings } = await import('../core/writer/writer-mappings')
  const fileTypes = Object.keys(writerMappings)
  const fileTypeFilter = (file: string) => fileTypes.some(type => file.endsWith(type))
  const dir = readdirSync('.')
  const discFiles = dir.filter(f => f.match(/^Disc (\d+)/)).flatMap(f => readdirSync(f).map(inner => `${f}/${inner}`)).filter(fileTypeFilter)
  const files = dir.filter(fileTypeFilter).concat(discFiles).slice(0, metadata.length)
  if (files.length === 0) {
    console.log('未找到任何支持的音乐文件.')
    process.exit()
  }
  const targetFiles = files.map((file, index) => {
    const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2)
    let dir = dirname(file)
    if (dir === '.') {
      dir = ''
    } else {
      dir += '/'
    }
    return dir + `${metadata[index].trackNumber.padStart(maxLength, '0')} ${metadata[index].title}${extname(file)}`.replace(/[\/\\:\*\?"<>\|]/g, '')
  })
  log(files, targetFiles)
  files.forEach((file, index) => {
    renameSync(file, targetFiles[index])
  })
  return targetFiles
}
const writeMetadataToFile = async (metadata: Metadata[], targetFiles: string[]) => {
  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i]
    console.log(file)
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
  //   console.log(file)
  //   const type = extname(file)
  //   return writerMappings[type].write(metadata[index], file)
  // }))
  const coverBuffer = metadata[0].coverImage
  if (cliOptions.cover && coverBuffer) {
    const imageType = await import('image-type')
    const type = imageType(coverBuffer)
    if (type !== null) {
      const coverFilename = `cover.${type.ext}`
      console.log(coverFilename)
      writeFileSync(coverFilename, coverBuffer)
    }
  }
}
const fetchMetadata = async (album: string) => {
  console.log(`下载专辑信息中: ${album}`)
  const metadata = await downloadMetadata(album)
  console.log('创建文件中...')
  const targetFiles = await createFiles(metadata)
  console.log('写入专辑信息中...')
  await writeMetadataToFile(metadata, targetFiles)
  console.log(`成功写入了专辑信息: ${album}`)
  process.exit()
}
const reader = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
const defaultAlbumName = basename(process.cwd())
reader.question(`请输入专辑名称(${defaultAlbumName}): `, async album => {
  if (!album) {
    album = defaultAlbumName
  }
  console.log('搜索中...')
  const { sourceMappings } = await import(`../core/metadata/source-mappings`)
  const metadataSource = sourceMappings[cliOptions.source]
  if (!metadataSource) {
    console.log(`未找到与'${cliOptions.source}'相关联的数据源.`)
    process.exit()
  }
  const searchResult = await metadataSource.resolveAlbumName(album)
  const handleError = (error: any) => {
    if (error instanceof Error) {
      console.error(`错误: ${error.message}`)
      process.exit()
    } else {
      throw error
    }
  }
  if (typeof searchResult === 'string') {
    await fetchMetadata(album).catch(handleError)
  } else if (searchResult.length > 0) {
    console.log('未找到匹配专辑, 以下是搜索结果:')
    console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'))
    reader.question('输入序号可选择相应条目, 或输入其他任意字符退出程序: ', async answer => {
      const index = parseInt(answer)
      if (isNaN(index) || index < 1 || index > searchResult.length) {
        process.exit()
      }
      await fetchMetadata(searchResult[index - 1]).catch(handleError)
    })
  } else {
    console.log('未找到匹配专辑, 且没有搜索结果, 请尝试使用更准确的专辑名称.')
    process.exit()
  }
})