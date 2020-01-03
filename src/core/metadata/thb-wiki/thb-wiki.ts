import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import Axios from 'axios'
import { JSDOM } from 'jsdom'
import { MetadataSeparator, MetadataConfig } from '../../core-config'

type TrackParseInfo = { name: string, result: string | string[] }

export class THBWiki extends MetadataSource {
  // https://thwiki.cc/api.php?action=opensearch&format=json&search=kappa&limit=20&suggest=true
  async resolveAlbumName(albumName: string) {
    // const url = `https://thwiki.cc/index.php?search=${encodeURIComponent(albumName)}`
    // const document = new JSDOM((await Axios.get(url)).data).window.document
    // const header = document.querySelector('#firstHeading')
    // // 未找到精确匹配, 返回搜索结果
    // if (header && header.textContent === '搜索结果') {
    //   return [...document.querySelectorAll('.mw-search-result-heading a')]
    //     .map(it => it.textContent!)
    //     .filter(it => !it.startsWith('歌词:'))
    // } else {
    //   return albumName
    // }
    const url = `https://thwiki.cc/api.php?action=opensearch&format=json&search=${encodeURIComponent(albumName)}&limit=20&suggest=true`
    const response = await Axios.get(url, {
      responseType: 'json'
    })
    if (response.status === 200) {
      const [, names] = response.data
      const [name] = (names as string[]).filter(it => !it.startsWith('歌词:'))
      if (name === albumName) {
        return name
      } else {
        return names
      }
    } else {
      return []
    }
  }
  private async getAlbumCover(img: HTMLImageElement) {
    const src = img.src.replace('/thumb/', '/')
    const url = src.substring(0, src.lastIndexOf('/'))
    const response = await Axios.get(url, { responseType: 'arraybuffer' })
    return response.data as Buffer
  }
  private getAlbumData(infoTable: Element) {
    function getTableItem(labelName: string): string
    function getTableItem(labelName: string, multiple: true): string[]
    function getTableItem(labelName: string, multiple = false) {
      const labelElements = [...infoTable.querySelectorAll('.label')]
        .filter(it => it.innerHTML.trim() === labelName)
      if (labelElements.length === 0) {
        return ''
      }
      const [item] = labelElements.map(it => {
        const nextElement = it.nextElementSibling as HTMLElement
        if (multiple) {
          return [...nextElement.querySelectorAll('a')]
            .map(element => element.textContent)
        } else {
          return nextElement.textContent!.trim()
        }
      })
      return item
    }
    const album = getTableItem('名称')
    const albumOrder = getTableItem('编号')
    const albumArtists = getTableItem('制作方', true)
    const genres = getTableItem('风格类型').split('，')
    const year = parseInt(getTableItem('首发日期')).toString()
    return {
      album,
      albumOrder,
      albumArtists,
      genres,
      year
    }
  }
  private getRelatedRows(trackNumberRow: Element): Element[] {
    const nextElement = trackNumberRow.nextElementSibling
    if (nextElement === null || nextElement.querySelector('.left') === null) {
      return []
    }
    return [nextElement, ...this.getRelatedRows(nextElement)]
  }
  private parseRelatedRowInfo(trackInfoRow: Element): TrackParseInfo {
    const defaultInfoParser = (name: string): (data: Element) => TrackParseInfo => {
      return (data: Element) => {
        let textContent = data.textContent!
        /*
          要是这个值就是一个_, THBWiki 会转成一个警告...
          例如疯帽子茶会'千年战争'中出现的编曲者就有一个_
          https://thwiki.cc/%E5%8D%83%E5%B9%B4%E6%88%98%E4%BA%89%EF%BD%9Eiek_loin_staim_haf_il_dis_o-del_al
        */
        const warningMatch = textContent.match(/包含无效字符或不完整，并因此在查询或注释过程期间导致意外结果。\[\[(.+)\]\]/)
        if (warningMatch) {
          textContent = warningMatch[1]
        }
        return {
          name,
          result: textContent.trim().split('，')
        }
      }
    }
    const label = trackInfoRow.querySelector('.label')!.textContent!.trim()
    const data = trackInfoRow.querySelector('.text') as HTMLElement
    const actions: { [infoName: string]: (data: HTMLElement) => TrackParseInfo } = {
      编曲: defaultInfoParser('arrangers'),
      再编曲: defaultInfoParser('remix'),
      作曲: defaultInfoParser('composers'),
      演唱: defaultInfoParser('vocals'),
      翻唱: defaultInfoParser('coverVocals'),
      和声: defaultInfoParser('harmonyVocals'),
      伴唱: defaultInfoParser('accompanyVocals'),
      合唱: defaultInfoParser('chorusVocals'),
      // 演奏: defaultInfoParser('instruments'),
      作词: defaultInfoParser('lyricists'),
      演奏: (data) => {
        const name = 'instruments'
        const rows = data.innerHTML.split('<br>').map(it => {
          const [instrument, performer] = it.trim().split('：').map(row => {
            return new JSDOM(row).window.document.body.textContent!!
          })
          return performer ? performer : instrument
        })
        return {
          name,
          result: rows
        }
      },
      原曲: (data) => {
        let result = `原曲: `
        const sources = [...data.querySelectorAll('.ogmusic,.source')] as Element[]
        sources.forEach((element, index) => {
          if (element.classList.contains('ogmusic')) {
            result += element.textContent!.trim()
            // 后面还有原曲时加逗号
            if (index < sources.length - 1 && sources[index + 1].classList.contains('ogmusic')) {
              result += MetadataSeparator
            }
          } else { // .source
            result += ` (${element.textContent!.trim()})`
            // 不是最后一个source时加逗号
            if (index !== sources.length - 1) {
              result += MetadataSeparator
            }
          }
        })
        return {
          name: 'comments',
          result,
        }
      }
    }
    const action = actions[label]
    if (!action) {
      return { name: 'other', result: '' }
    }
    return action(data)
  }
  private rowDataNormalize(rowData: any) {
    const normalizeAction = (str: string) => {
      return str.replace('（人物）', '')
    }
    for (const [key, value] of Object.entries(rowData)) {
      if (typeof value === 'string') {
        rowData[key] = normalizeAction(value)
      }
      if (Array.isArray(value)) {
        rowData[key] = value.map(v => normalizeAction(v))
      }
    }
  }
  private async parseRow(trackNumberElement: Element) {
    const trackNumber = parseInt(trackNumberElement.textContent!, 10).toString()
    const trackNumberRow = trackNumberElement.parentElement as HTMLTableRowElement
    const title = trackNumberRow.querySelector('.title')!.textContent!.trim()
    const { lyricLanguage, lyric } = await (async () => {
      const lyricLink = trackNumberRow.querySelector(':not(.new) > a:not(.external)') as HTMLAnchorElement
      if (this.config.lyric && lyricLink) {
        const { downloadLyrics } = await import('./lyrics/thb-wiki-lyrics')
        return await downloadLyrics('https://thwiki.cc' + lyricLink.href, title, this.config.lyric)
      } else {
        return {
          lyric: undefined,
          lyricLanguage: undefined
        }
      }
    })()
    const relatedInfoRows = this.getRelatedRows(trackNumberRow)
    const infos = relatedInfoRows.map(it => this.parseRelatedRowInfo(it))
    const [lyricists] = infos
      .filter(it => it.name === 'lyricists')
      .map(it => it.result as string[])
    const [comments] = infos
      .filter(it => it.name === 'comments')
      .map(it => it.result as string)
    const arrangers = ['remix', 'arrangers']
      .flatMap(name => infos
        .filter(it => it.name === name)
        .map(it => it.result as string[])
        .flat()
      )
    const performers = ['vocals', 'coverVocals', 'harmonyVocals', 'accompanyVocals', 'chorusVocals', 'instruments']
      .flatMap(name => infos
        .filter(it => it.name === name)
        .map(it => it.result as string[])
        .flat()
      )
    const artists = performers.concat(arrangers)
    const [composers] = infos
      .filter(it => it.name === 'composers')
      .map(it => it.result as string[])
    if (arrangers.length === 0) {
      artists.push(...composers)
    }
    const rowData = {
      title,
      artists: [...new Set(artists)],
      trackNumber,
      comments,
      lyricists,
      composers,
      lyric,
      lyricLanguage,
    }
    this.rowDataNormalize(rowData)
    return rowData
  }
  async getMetadata(albumName: string, config?: MetadataConfig) {
    this.config = Object.assign(this.config, config)
    const url = `https://thwiki.cc/index.php?search=${encodeURIComponent(albumName)}`
    const response = await Axios.get(url)
    const dom = new JSDOM(response.data)
    const document = dom.window.document
    const infoTable = document.querySelector('.doujininfo') as HTMLTableElement
    if (!infoTable) {
      throw new Error('页面不是同人专辑词条')
    }
    const {
      album,
      albumOrder,
      albumArtists,
      genres,
      year
    } = this.getAlbumData(infoTable)
    const coverImageElement = document.querySelector('.cover-artwork img') as HTMLImageElement
    const coverImage = coverImageElement ? await this.getAlbumCover(coverImageElement) : undefined

    const musicTables = [...document.querySelectorAll('.musicTable')] as HTMLTableElement[]
    let discNumber = 1
    const metadatas = [] as Metadata[]
    for (const table of musicTables) {
      const trackNumbers = [...table.querySelectorAll('tr > td[class^="info"]')] as HTMLTableDataCellElement[]
      for (const trackNumberElement of trackNumbers) {
        const metadata: Metadata = {
          discNumber: discNumber.toString(),
          album,
          albumOrder,
          albumArtists,
          genres,
          year,
          coverImage,
          ...(await this.parseRow(trackNumberElement))
        }
        metadatas.push(metadata)
      }
      discNumber++
    }
    return metadatas
  }
}
export const thbWiki = new THBWiki()