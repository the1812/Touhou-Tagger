import Axios, { AxiosResponse } from 'axios'
import { JSDOM } from 'jsdom'
import { MetadataConfig } from '../../../core-config'
import { log } from '../../../debug'
import { getLyricParser, LyricParser } from './lyric-parser'

let lyricParser: LyricParser
const downloadMetadataLyrics = async () => {
  const lyric = lyricParser.readLyric()
  const lyricLanguage = lyricParser.findLanguage()
  log(lyricLanguage)
  log(lyric)
  return {
    lyric,
    lyricLanguage,
  }
}
const downloadLrcLyrics = async (title: string, index: number, config: MetadataConfig) => {
  const language = lyricParser.findLanguage()
  const indexString = index === 0 ? '' : `.${index + 1}`
  const url = `https://touhou.cd/lyrics/${encodeURIComponent(title)}${indexString}${language}.lrc`
  log(url)
  let response: AxiosResponse<string>
  try {
    response = await Axios.get(url, { responseType: 'text', timeout: config.timeout * 1000 })
    return {
      lyric: response.data,
      lyricLanguage: undefined
    }
  } catch (error) {
    console.error(`下载歌词失败: ${url}`)
    return {
      lyric: '',
      lyricLanguage: undefined
    }
  }
}
const lyricDocumentCache: { url: string; document: Document }[] = []
export const downloadLyrics = async (url: string, title: string, config: Required<MetadataConfig>) => {
  log(`\n下载歌词中: ${title}`)
  let document = lyricDocumentCache.find(it => it.url === url)?.document
  if (!document) {
    const response = await Axios.get(url, { timeout: config.timeout * 1000 })
    const dom = new JSDOM(response.data)
    document = dom.window.document
    lyricDocumentCache.push({ url, document })
    if (lyricDocumentCache.length > config.lyric.maxCacheSize) {
      lyricDocumentCache.shift()
    }
  }
  let table: HTMLTableElement
  const tables = [...document.querySelectorAll('.wikitable[class*="tt-type-lyric"]')] as HTMLTableElement[]
  log('tables length: ', tables.length)
  if (tables.length > 1) { // 歌词可能有多个版本
    const titles = tables.map(table => {
      const t = table.parentElement.title
      return t.substring(0, t.length - 1) // 移除最后一个'版'字
    })
    log(titles)
    // 如果传入的标题匹配(包含)其中某个标题, 就使用对应版本, 否则使用默认版本
    // 反转了一下让后面的优先匹配
    const matchIndex = [...titles].reverse().findIndex(t => title.includes(t))
    log(matchIndex, tables.length - matchIndex - 1)
    if (matchIndex !== -1) {
      table = tables[tables.length - matchIndex - 1]
    } else {
      [table] = tables
    }
    log(table)
  } else {
    [table] = tables
  }
  lyricParser = getLyricParser(table, config.lyric)
  switch (config.lyric.output) {
    case 'metadata':
    default:
      return await downloadMetadataLyrics()
    case 'lrc':
      const originalTitle = document.querySelector('.firstHeading').textContent.replace('歌词:', '')
      return await downloadLrcLyrics(originalTitle, tables.indexOf(table), config)
  }
}