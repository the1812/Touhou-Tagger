import Axios from 'axios'
import { JSDOM } from 'jsdom'
import { LyricConfig } from '../core-config'
import { log } from '../debug'

const findLanguage = (table: HTMLTableElement, config: LyricConfig) => {
  const [row] = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')]
  const [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')]
  switch (config.type) {
    case 'original': {
      return originalData.getAttribute('lang')!!
    }
    case 'translated': {
      return translatedData.getAttribute('lang')!!
    }
    case 'mixed':
    default:
      return undefined
  }
}
const downloadMetadataLyrics = async (table: HTMLTableElement, config: LyricConfig) => {
  const rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')]
  let lyric = ''
  rows.forEach(row => {
    if (row.classList.contains('tt-lyrics-sep')) {
      lyric += '\n'
    } else {
      const [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')]
      switch (config.type) {
        case 'original': {
          lyric += originalData.textContent + '\n'
          break
        }
        case 'translated': {
          lyric += translatedData.textContent + '\n'
          break
        }
        case 'mixed': {
          lyric += originalData.textContent + '\n' + translatedData.textContent + '\n'
          break
        }
      }
    }
  })
  const lyricLanguage = findLanguage(table, config)
  log(lyric.length)
  log(lyricLanguage)
  return {
    lyric,
    lyricLanguage,
  }
}
const downloadLrcLyrics = async (table: HTMLTableElement, title: string, index: number, config: LyricConfig) => {
  const language = (() => {
    switch (config.type) {
      default:
      case 'original':
        return ''
      case 'translated':
        return '.' + findLanguage(table, config)
      case 'mixed':
        return '.all'
    }
  })()
  const indexString = index === 0 ? '' : `.${index + 1}`
  const url = `https://touhou.cd/lyrics/${encodeURIComponent(title)}${indexString}${language}.lrc`
  log(url)
  const response = await Axios.get(url, { responseType: 'text' })
  return {
    lyric: response.data as string,
    lyricLanguage: undefined
  }
}
export const downloadLyrics = async (url: string, title: string, config: LyricConfig) => {
  console.log(`下载歌词中: ${title}`)
  const response = await Axios.get(url)
  const dom = new JSDOM(response.data)
  const document = dom.window.document
  let table: HTMLTableElement
  const tables = [...document.querySelectorAll('.wikitable.tt-type-lyrics')] as HTMLTableElement[]
  if (tables.length > 1) { // 歌词可能有多个版本
    const titles = tables.map(table => {
      const t = table.parentElement!!.title
      return t.substring(0, t.length - 1) // 移除最后一个'版'字
    })
    // 如果传入的标题匹配(包含)其中某个标题, 就使用对应版本, 否则使用默认版本
    // 反转了一下让后面的优先匹配
    const matchIndex = [...titles].reverse().findIndex(t => title.includes(t))
    if (matchIndex) {
      table = tables[tables.length - matchIndex - 1]
    } else {
      [table] = tables
    }
  } else {
    [table] = tables
  }
  switch (config.output) {
    case 'metadata':
    default:
      return await downloadMetadataLyrics(table, config)
    case 'lrc':
      const originalTitle = document.querySelector('.firstHeading')!!.textContent!!.replace('歌词:', '')
      return await downloadLrcLyrics(table, originalTitle, tables.indexOf(table), config)
  }
}