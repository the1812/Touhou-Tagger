#!/usr/bin/env node
import * as readline from "readline"
import { basename } from 'path'

const getMetadata = async (album: string) => {
  console.log(`下载专辑信息中: ${album}`)
  const { thbWiki } = await import('../core/metadata/thb-wiki')
  const metadata = await thbWiki.getMetadata(album)
  console.log('创建文件中...')
  const { readdirSync, renameSync } = await import('fs')
  const files = readdirSync('.').filter(file => file.endsWith('.mp3'))
  const targetFiles = files.map((_, index) => {
    const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2)
    return `${(index + 1).toString().padStart(maxLength, '0')} ${metadata[index].title}.mp3`
  })
  files.forEach((file, index) => {
    renameSync(file, targetFiles[index])
  })
  console.log('写入专辑信息中...')
  const { mp3Writer } = await import('../core/writer/mp3-writer')
  await mp3Writer.writeAll(metadata, targetFiles)
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
  const { thbWiki } = await import('../core/metadata/thb-wiki')
  const searchResult = await thbWiki.resolveAlbumName(album)
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