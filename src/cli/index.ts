#!/usr/bin/env node
import * as readline from 'readline'
import { basename } from 'path'
import { resetSpinner, spinner } from './spinner'
import { cliOptions } from './options'

const reader = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
const defaultAlbumName = basename(process.cwd())
reader.question(`请输入专辑名称(${defaultAlbumName}): `, async album => {
  if (!album) {
    album = defaultAlbumName
  }
  await resetSpinner()
  const { sourceMappings } = await import(`../core/metadata/source-mappings`)
  const metadataSource = sourceMappings[cliOptions.source]
  if (!metadataSource) {
    spinner.fail(`未找到与'${cliOptions.source}'相关联的数据源.`)
    process.exit()
  }
  const searchResult = await metadataSource.resolveAlbumName(album)
  const handleError = (error: any) => {
    if (error instanceof Error) {
      spinner.fail(`错误: ${error.message}`)
      process.exit()
    } else {
      throw error
    }
  }
  const { fetchMetadata } = await import('./fetch-metadata')
  if (typeof searchResult === 'string') {
    await fetchMetadata(album).catch(handleError)
  } else if (searchResult.length > 0) {
    spinner.fail('未找到匹配专辑, 以下是搜索结果:')
    console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'))
    reader.question('输入序号可选择相应条目, 或输入其他任意字符退出程序: ', async answer => {
      const index = parseInt(answer)
      if (isNaN(index) || index < 1 || index > searchResult.length) {
        process.exit()
      }
      await fetchMetadata(searchResult[index - 1]).catch(handleError)
    })
  } else {
    spinner.fail('未找到匹配专辑, 且没有搜索结果, 请尝试使用更准确的专辑名称.')
    process.exit()
  }
})