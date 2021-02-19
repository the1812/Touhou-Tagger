import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { Ora } from 'ora'
import { extname, resolve } from 'path'
import { Metadata, MetadataSource } from '../core'
import { MetadataConfig } from '../core/core-config'
import { log } from '../core/debug'
import { CliOptions } from './options'
import { readline } from './readline'

export class CliTagger {
  workingDir = '.'
  metadataSource: MetadataSource
  constructor(
    public cliOptions: CliOptions,
    public metadataConfig: MetadataConfig,
    public spinner: Ora,
  ) {}
  async downloadCover(album: string) {
    const { sourceMappings } = await import(`../core/metadata/source-mappings`)
    const metadataSource = sourceMappings[this.cliOptions.source]
    metadataSource.config = this.metadataConfig
    this.metadataSource = metadataSource
    const localCoverFiles = readdirSync(this.workingDir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.match(/^cover\.(jpg|jpeg|jpe|tif|tiff|bmp|png)$/))
      .map(f => f.name)
    if (localCoverFiles.length > 0) {
      const [coverFile] = localCoverFiles
      const buffer = readFileSync(resolve(this.workingDir, coverFile))
      metadataSource.coverBuffer = buffer
      return buffer
    }
    return await metadataSource.getCover(album)
  }
  async downloadMetadata(album: string) {
    if (!this.metadataSource) {
      await this.downloadCover(album)
    }
    return await this.metadataSource.getMetadata(album)
  }
  async createFiles(metadata: Metadata[]) {
    const { readdirSync, renameSync } = await import('fs')
    const { dirname } = await import('path')
    const { writerMappings } = await import('../core/writer/writer-mappings')
    const fileTypes = Object.keys(writerMappings)
    const fileTypeFilter = (file: string) => fileTypes.some(type => file.endsWith(type))
    const dir = readdirSync(this.workingDir)
    const discFiles = dir
      .filter(f => f.match(/^Disc (\d+)/))
      .flatMap(f => readdirSync(f)
      .map(inner => `${f}/${inner}`))
      .filter(fileTypeFilter)
    const files = dir
      .filter(fileTypeFilter)
      .concat(discFiles)
      .slice(0, metadata.length)
      .map(f => resolve(this.workingDir, f))
    if (files.length === 0) {
      const message = '未找到任何支持的音乐文件.'
      this.spinner.fail(message)
      throw new Error(message)
    }
    const targetFiles = files.map((file, index) => {
      const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2)
      const filename = `${metadata[index].trackNumber.padStart(maxLength, '0')} ${metadata[index].title}${extname(file)}`.replace(/[\/\\:\*\?"<>\|]/g, '')
      return resolve(dirname(file), filename)
    })
    log(files, targetFiles)
    files.forEach((file, index) => {
      renameSync(file, targetFiles[index])
    })
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
      if (this.cliOptions.lyric && this.cliOptions['lyric-output'] === 'lrc' && metadata[i].lyric) {
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
    if (this.cliOptions.cover && coverBuffer) {
      const imageType = await import('image-type')
      const type = imageType(coverBuffer)
      if (type !== null) {
        const coverFilename = resolve(this.workingDir, `cover.${type.ext}`)
        log('cover file', coverFilename)
        writeFileSync(coverFilename, coverBuffer)
      }
    }
  }
  async fetchMetadata(album: string) {
    this.spinner.start(`下载专辑封面中: ${album}`)
    await this.downloadCover(album)
    this.spinner.text = `下载专辑信息中: ${album}`
    const metadata = await this.downloadMetadata(album)
    this.spinner.text = '创建文件中'
    const targetFiles = await this.createFiles(metadata)
    this.spinner.text = '写入专辑信息中'
    await this.writeMetadataToFile(metadata, targetFiles)
    this.spinner.succeed(`成功写入了专辑信息: ${album}`)
  }
  async run(album: string) {
    this.spinner.text = '搜索中'
    const { sourceMappings } = await import(`../core/metadata/source-mappings`)
    const metadataSource = sourceMappings[this.cliOptions.source]
    if (!metadataSource) {
      const message = `未找到与'${this.cliOptions.source}'相关联的数据源.`
      this.spinner.fail(message)
      throw new Error(message)
    }
    const searchResult = await metadataSource.resolveAlbumName(album)
    const handleError = (error: any) => {
      if (error instanceof Error) {
        this.spinner.fail(`错误: ${error.message}`)
      } else {
        throw error
      }
    }
    if (typeof searchResult === 'string') {
      await this.fetchMetadata(album).catch(handleError)
    } else if (this.cliOptions['no-interactive']) {
      this.spinner.fail('未找到匹配专辑或有多个搜索结果')
    } else if (searchResult.length > 0) {
      this.spinner.fail('未找到匹配专辑, 以下是搜索结果:')
      console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'))
      const answer = await readline('输入序号可选择相应条目, 或输入其他任意字符退出程序: ')
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