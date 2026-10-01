import { readFile, readdir } from 'fs/promises'
import { resolve as resolvePath } from 'path'

import { Ora } from 'ora'

import { MetadataConfig } from '../core/core-config.js'
import { log } from '../core/debug.js'
import { Metadata } from '../core/index.js'
import type { AlbumCandidate } from '../core/metadata/metadata-source.js'
import { readline } from '../core/readline.js'
import { setAlbumOptions } from './album-options.js'
import { CliCommandBase } from './command-base.js'
import { getDefaultAlbumName } from './default-album-name.js'
import { DefaultMetadataSource, getMetadataConfig } from './options.js'
import { createFiles, writeMetadataToFile } from './tagger-files.js'

const TimeoutError = new Error('timeout')
export class CliTagger extends CliCommandBase {
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
    const { expandMetadataInfo: normalize } =
      await import('../core/metadata/normalize/normalize.js')
    return normalize({
      metadatas: JSON.parse(json) as Metadata[],
      cover: await this.getLocalCover(),
    })
  }
  async downloadMetadata(album: string, cover?: Buffer) {
    const { sourceMappings } = await import('../core/metadata/source-mappings.js')
    const metadataSource = sourceMappings[this.options.source]
    if (!metadataSource) {
      throw new Error(`未找到与'${this.options.source}'相关联的数据源.`)
    }
    metadataSource.config = this.metadataConfig
    return metadataSource.getMetadata(album, { cover })
  }
  async withRetry<T>(action: () => Promise<T>) {
    let retryCount = 0
    while (retryCount < this.options.retry) {
      try {
        let timeout: ReturnType<typeof setTimeout> | undefined
        try {
          return await Promise.race([
            action(),
            new Promise<T>((resolve, reject) => {
              timeout = setTimeout(() => reject(TimeoutError), this.options.timeout * 1000)
            }),
          ])
        } finally {
          clearTimeout(timeout)
        }
      } catch (error) {
        retryCount += 1
        const reason = (() => {
          if (error === TimeoutError) {
            return `操作超时(${String(this.options.timeout)}秒)`
          }
          if (!error) {
            return '发生未知错误'
          }
          if (error instanceof Error && error.stack) {
            return error.stack
          }
          return typeof error === 'string' ? error : JSON.stringify(error)
        })()
        log('\nretry get error', retryCount, reason)
        if (error === TimeoutError && retryCount < this.options.retry) {
          this.spinner.fail(`${reason}, 进行第${String(retryCount)}次重试...`)
        } else {
          throw new Error(reason)
        }
      }
    }
    throw new Error('发生未知错误')
  }
  async fetchMetadata(candidate: AlbumCandidate) {
    const album = candidate.name
    return this.withRetry(async () => {
      const { batch } = this.options
      this.spinner.start(batch ? '下载专辑信息中' : `下载专辑信息中: ${album}`)
      const localCover = await this.getLocalCover()
      const localJson = await this.getLocalJson()
      const metadata = localJson || (await this.downloadMetadata(candidate.id, localCover))
      log('final metadata', metadata)
      this.spinner.text = '创建文件中'
      const targetFiles = await createFiles(metadata, this.workingDir, this.spinner)
      this.spinner.text = '写入专辑信息中'
      await writeMetadataToFile(
        metadata,
        targetFiles,
        this.workingDir,
        this.metadataConfig,
        this.options,
      )
      if (!localJson) {
        const defaultAlbumName = await getDefaultAlbumName(this.workingDir)
        await setAlbumOptions(this.workingDir, {
          source: this.options.source === DefaultMetadataSource ? undefined : this.options.source,
          ...(album !== defaultAlbumName ? { defaultAlbumHint: album } : {}),
        })
      }
      this.spinner.succeed(batch ? '成功写入了专辑信息' : `成功写入了专辑信息: ${album}`)
    })
  }
  async run(album: string) {
    await this.loadAlbumOptions()
    this.metadataConfig = getMetadataConfig(this.options)
    const { sourceMappings } = await import('../core/metadata/source-mappings.js')
    const metadataSource = sourceMappings[this.options.source]
    const noInteractive = !this.options.interactive
    if (!metadataSource) {
      const message = `未找到与'${this.options.source}'相关联的数据源.`
      this.spinner.fail(message)
      throw new Error(message)
    }
    metadataSource.config = this.metadataConfig
    log('searching')
    const handleError = (error: unknown) => {
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
        return [{ id: '', name: localJson[0].album }]
      }
      return metadataSource.search(album)
    }).catch((error: unknown) => {
      handleError(error)
      return [] as AlbumCandidate[]
    })
    log('fetching metadata')
    const normalizeName = (name: string) => name.normalize('NFKC').toLowerCase().trim()
    const hasLocalMetadata = Boolean(localJson?.length)
    const hasSingleResult = searchResult.length === 1
    const isExactMatch =
      hasSingleResult && normalizeName(searchResult[0].name) === normalizeName(album)
    const canAutoSelect = hasSingleResult && (noInteractive || isExactMatch)
    let selected: AlbumCandidate | undefined
    if (hasLocalMetadata || canAutoSelect) {
      selected = searchResult[0]
    }
    if (selected) {
      await this.fetchMetadata(selected).catch(handleError)
    } else if (noInteractive) {
      this.spinner.fail('未找到匹配专辑或有多个搜索结果')
    } else if (searchResult.length > 0) {
      this.spinner.fail('未找到匹配专辑, 以下是搜索结果:')
      console.log(
        searchResult
          .map(
            (it, index) =>
              `${String(index + 1)}\t${[it.name, it.description].filter(Boolean).join(' · ')}`,
          )
          .join('\n'),
      )
      const answer = await readline('输入序号可选择相应条目, 或输入其他任意字符取消本次操作: ')
      if (answer === undefined) {
        return
      }
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
