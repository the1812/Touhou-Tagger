#!/usr/bin/env node
import * as readline from "readline"
import { basename, extname } from 'path'
import { writeFileSync } from 'fs'
import * as commandLineArgs from 'command-line-args'

const cliOptions = commandLineArgs([
  { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
  { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' }
]) as {
  cover: boolean
  source: string
}
const getMetadata = async (album: string) => {
  console.log(`下载专辑信息中: ${album}`)
  const { sourceMappings } = await import(`../core/metadata/source-mappings`)
  const metadata = await sourceMappings[cliOptions.source].getMetadata(album)
  console.log('创建文件中...')
  const { readdirSync, renameSync } = await import('fs')
  const { writerMappings } = await import('../core/writer/writer-mappings')
  const fileTypes = Object.keys(writerMappings)
  const files = readdirSync('.').filter(file => fileTypes.some(type => file.endsWith(type)))
  if (files.length === 0) {
    console.log('未找到任何支持的音乐文件.')
    process.exit()
  }
  const targetFiles = files.map((file, index) => {
    const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2)
    return `${(index + 1).toString().padStart(maxLength, '0')} ${metadata[index].title}${extname(file)}`
  })
  files.forEach((file, index) => {
    renameSync(file, targetFiles[index])
  })
  console.log('写入专辑信息中...')
  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i]
    console.log(file)
    const type = extname(file)
    await writerMappings[type].write(metadata[i], file)
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
  if (typeof searchResult === 'string') {
    await getMetadata(album)
  } else {
    console.log('未找到匹配专辑, 以下是搜索结果:')
    console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'))
    reader.question('输入序号可选择相应条目, 或输入其他任意字符退出程序: ', async answer => {
      const index = parseInt(answer)
      if (isNaN(index) || index < 1 || index > searchResult.length) {
        process.exit()
      }
      await getMetadata(searchResult[index - 1])
    })
  }
})