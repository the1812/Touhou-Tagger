import { Metadata } from '../core'
import { spinner } from './spinner'
import { extname } from 'path'
import { log } from '../core/debug'

export const createFiles = async (metadata: Metadata[]) => {
  const { readdirSync, renameSync } = await import('fs')
  const { dirname } = await import('path')
  const { writerMappings } = await import('../core/writer/writer-mappings')
  const fileTypes = Object.keys(writerMappings)
  const fileTypeFilter = (file: string) => fileTypes.some(type => file.endsWith(type))
  const dir = readdirSync('.')
  const discFiles = dir.filter(f => f.match(/^Disc (\d+)/)).flatMap(f => readdirSync(f).map(inner => `${f}/${inner}`)).filter(fileTypeFilter)
  const files = dir.filter(fileTypeFilter).concat(discFiles).slice(0, metadata.length)
  if (files.length === 0) {
    spinner.fail('未找到任何支持的音乐文件.')
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