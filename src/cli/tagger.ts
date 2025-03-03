import { Ora } from 'ora'
import { extname, resolve as resolvePath } from 'path'
import { readFile, readdir, rename, writeFile } from 'fs/promises'
import { Metadata, MetadataSource } from '../core'
import { MetadataConfig } from '../core/core-config'
import { log } from '../core/debug'
import { getMetadataConfig } from './options'
import { readline } from '../core/readline'
import { CliCommandBase } from './command-base'
import { getDefaultAlbumName } from './default-album-name'
import { setAlbumOptions } from './album-options'
import { asyncFlatMap } from './helper'

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
const TimeoutError = Symbol('timeout')
export class CliTagger extends CliCommandBase {
  metadataSource: MetadataSource
  metadataConfig: MetadataConfig
  constructor(public spinner: Ora) {
    super()
    this.metadataConfig = getMetadataConfig(this.options)
  }
  async getLocalCover() {
    const localCoverFiles = (await readdir(this.workingDir, { withFileTypes: true }))
      .filter(f => f.isFile() && f.name.match(/^cover\.(jpg|jpeg|jpe|tif|tiff|bmp|png)$/))
      .map(f => f.name)
    if (localCoverFiles.length === 0) {
      return undefined
    }
    const [coverFile] = localCoverFiles
    const buffer = await readFile(resolvePath(this.workingDir, coverFile))
    return buffer
  }
  async getLocalJson() {
    const localMetadataFiles = (await readdir(this.workingDir, { withFileTypes: true }))
      .filter(f => f.isFile() && f.name.match(/^metadata\.jsonc?$/))
      .map(f => f.name)
    if (localMetadataFiles.length === 0) {
      return undefined
    }
    const [localMetadata] = localMetadataFiles
    const json = await readFile(resolvePath(this.workingDir, localMetadata), { encoding: 'utf8' })
    log('localJson get')
    log(json)
    const { expandMetadataInfo: normalize } = await import('../core/metadata/normalize/normalize')
    return normalize({
      metadatas: JSON.parse(json) as Metadata[],
      cover: await this.getLocalCover(),
    })
  }
  async downloadMetadata(album: string, cover?: Buffer) {
    const { sourceMappings } = await import(`../core/metadata/source-mappings`)
    const metadataSource = sourceMappings[this.options.source]
    metadataSource.config = this.metadataConfig
    this.metadataSource = metadataSource
    return this.metadataSource.getMetadata(album, cover)
  }
  async createFiles(metadata: Metadata[]) {
    const { dirname } = await import('path')
    const { writerMappings } = await import('../core/writer/writer-mappings')
    const fileTypes = Object.keys(writerMappings)
    const fileTypeFilter = (file: string) => fileTypes.some(type => file.endsWith(type))
    const dir = (await readdir(this.workingDir)).sort(leadingNumberSort)
    const discFiles = (
      await asyncFlatMap(
        dir.filter(f => f.match(/^Disc (\d+)/)),
        async f => {
          return (await readdir(resolvePath(this.workingDir, f)))
            .sort(leadingNumberSort)
            .map(inner => `${f}/${inner}`)
        },
      )
    ).filter(fileTypeFilter)
    const files = dir
      .filter(fileTypeFilter)
      .concat(discFiles)
      .slice(0, metadata.length)
      .map(f => resolvePath(this.workingDir, f))
    if (files.length === 0) {
      const message = '未找到任何支持的音乐文件.'
      this.spinner.fail(message)
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
  async writeMetadataToFile(metadata: Metadata[], targetFiles: string[]) {
    const { writerMappings } = await import('../core/writer/writer-mappings')
    for (let i = 0; i < targetFiles.length; i++) {
      const file = targetFiles[i]
      log(file)
      const type = extname(file)
      const writer = writerMappings[type]
      writer.config = this.metadataConfig
      await writer.write(metadata[i], file)
      if (this.options.lyric && this.options['lyric-output'] === 'lrc' && metadata[i].lyric) {
        await writeFile(`${file.substring(0, file.lastIndexOf(type))}.lrc`, metadata[i].lyric)
      }
    }
    // FLAC 那个库放 Promise.all 里就只有最后一个会运行???
    // await Promise.all(targetFiles.map((file, index) => {
    //   log(file)
    //   const type = extname(file)
    //   return writerMappings[type].write(metadata[index], file)
    // }))
    const coverBuffer = metadata[0].coverImage
    if (this.options.cover && coverBuffer) {
      const { default: imageType } = await import('image-type')
      const type = imageType(coverBuffer)
      if (type !== null) {
        const coverFilename = resolvePath(this.workingDir, `cover.${type.ext}`)
        log('cover file', coverFilename)
        await writeFile(coverFilename, coverBuffer)
      }
    }
  }
  async withRetry<T>(action: () => Promise<T>) {
    let retryCount = 0
    while (retryCount < this.options.retry) {
      try {
        const result = await Promise.race([
          action(),
          new Promise<T>((resolve, reject) => {
            setTimeout(() => reject(TimeoutError), this.options.timeout * 1000)
          }),
        ])
        return result
      } catch (error) {
        retryCount += 1
        const reason = (() => {
          if (error === TimeoutError) {
            return `操作超时(${this.options.timeout}秒)`
          }
          if (!error) {
            return '发生未知错误'
          }
          if (error.stack) {
            return error.stack
          }
          return error.toString()
        })()
        log('\nretry get error', retryCount, reason)
        if (reason.stack) {
          log(`\n${reason.stack}`)
        }
        if (retryCount < this.options.retry) {
          this.spinner.fail(`${reason}, 进行第${retryCount}次重试...`)
        } else {
          throw new Error(reason)
        }
      }
    }
    throw new Error('发生未知错误')
  }
  async fetchMetadata(album: string) {
    return this.withRetry(async () => {
      const { batch } = this.options
      this.spinner.start(batch ? '下载专辑信息中' : `下载专辑信息中: ${album}`)
      const localCover = await this.getLocalCover()
      const localJson = await this.getLocalJson()
      const metadata = localJson || (await this.downloadMetadata(album, localCover))
      log('final metadata', metadata)
      this.spinner.text = '创建文件中'
      const targetFiles = await this.createFiles(metadata)
      this.spinner.text = '写入专辑信息中'
      await this.writeMetadataToFile(metadata, targetFiles)
      const defaultAlbumName = await getDefaultAlbumName(this.workingDir)
      if (album !== defaultAlbumName && !localJson) {
        await setAlbumOptions(this.workingDir, {
          defaultAlbumHint: album,
        })
      }
      this.spinner.succeed(batch ? '成功写入了专辑信息' : `成功写入了专辑信息: ${album}`)
    })
  }
  async run(album: string) {
    await this.loadAlbumOptions()
    const { sourceMappings } = await import(`../core/metadata/source-mappings`)
    const metadataSource = sourceMappings[this.options.source]
    const noInteractive = this.options['no-interactive']
    if (!metadataSource) {
      const message = `未找到与'${this.options.source}'相关联的数据源.`
      this.spinner.fail(message)
      throw new Error(message)
    }
    metadataSource.config = this.metadataConfig
    log('searching')
    const handleError = (error: any) => {
      if (error instanceof Error) {
        this.spinner.fail(`错误: ${error.message}`)
      } else {
        throw error
      }
    }
    const localJson = await this.getLocalJson()
    const searchResult = await this.withRetry(async () => {
      this.spinner.start('搜索中')
      if (localJson !== undefined && localJson.length > 0) {
        return localJson[0].album
      }
      const remoteResults = await metadataSource.resolveAlbumName(album)
      const hasOnlyOneResult = Array.isArray(remoteResults) && remoteResults.length === 1
      if (hasOnlyOneResult && noInteractive) {
        return remoteResults[0]
      }
      return remoteResults
    }).catch(error => {
      handleError(error)
      return [] as string[]
    })
    log('fetching metadata')
    if (typeof searchResult === 'string') {
      await this.fetchMetadata(searchResult).catch(handleError)
    } else if (noInteractive) {
      this.spinner.fail('未找到匹配专辑或有多个搜索结果')
    } else if (searchResult.length > 0) {
      this.spinner.fail('未找到匹配专辑, 以下是搜索结果:')
      console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'))
      const answer = await readline('输入序号可选择相应条目, 或输入其他任意字符取消本次操作: ')
      const index = parseInt(answer)
      if (isNaN(index) || index < 1 || index > searchResult.length) {
        return
      }
      await this.fetchMetadata(searchResult[index - 1]).catch(handleError)
    } else {
      this.spinner.fail('未找到匹配专辑, 且没有搜索结果, 请尝试使用更准确的专辑名称.')
    }
  }
}
