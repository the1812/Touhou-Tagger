import axios, { AxiosResponse } from 'axios'
import { parseHTML } from 'linkedom'
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
  const lyricLanguage = lyricParser.findLanguage()
  const languageSuffix = lyricParser.getLrcFileSuffix()
  const indexString = index === 0 ? '' : `.${index + 1}`
  const url = `https://touhou.cd/lyrics/${encodeURIComponent(title)}${indexString}${languageSuffix}.lrc`
  log(url)
  let response: AxiosResponse<string>
  try {
    response = await axios.get(url, { responseType: 'text', timeout: config.timeout * 1000 })
    return {
      lyric: response.data,
      lyricLanguage: lyricLanguage,
    }
  } catch (error) {
    console.error(`下载歌词失败: ${url}`)
    return {
      lyric: '',
      lyricLanguage: undefined,
    }
  }
}
const lyricDocumentCache: { url: string; document: Document }[] = []
export const downloadLyrics = async (
  url: string,
  title: string,
  config: Required<MetadataConfig>,
) => {
  log(`\n下载歌词中: ${title}`)
  let document = lyricDocumentCache.find(it => it.url === url)?.document
  if (!document) {
    log(url)
    let response: AxiosResponse<string>
    try {
      response = await axios.get(url, { timeout: config.timeout * 1000 })
    } catch (error) {
      console.error(`下载歌词页面失败: ${url}`)
      return {
        lyric: '',
        lyricLanguage: undefined,
      }
    }
    document = parseHTML(response.data).window.document
    lyricDocumentCache.push({ url, document })
    if (lyricDocumentCache.length > config.lyric.maxCacheSize) {
      lyricDocumentCache.shift()
    }
  }
  let lyricTable: HTMLTableElement
  const tables = [
    ...document.querySelectorAll('.wikitable[class*="tt-type-lyric"]'),
  ] as HTMLTableElement[]
  log('tables length: ', tables.length)
  if (tables.length > 1) {
    // 歌词可能有多个版本
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
      lyricTable = tables[tables.length - matchIndex - 1]
    } else {
      lyricTable = tables[0]
    }
    log(lyricTable)
  } else {
    lyricTable = tables[0]
  }
  lyricParser = getLyricParser(lyricTable, config.lyric)
  switch (config.lyric.output) {
    case 'lrc': {
      const originalTitle = document.querySelector('.firstHeading').textContent.replace('歌词:', '')
      return downloadLrcLyrics(originalTitle, tables.indexOf(lyricTable), config)
    }
    case 'metadata': // fallthrough
    default:
      return downloadMetadataLyrics()
  }
}
