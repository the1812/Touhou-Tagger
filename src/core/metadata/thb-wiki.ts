import { MetadataSource } from './metadata-source'
import { Metadata } from './metadata'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { MetadataSeparator } from '../core-config'

type TrackParseInfo = { name: string, result: string | string[] }

export class THBWiki implements MetadataSource {
  async resolveAlbumName(albumName: string) {
    const url = `https://thwiki.cc/index.php?search=${encodeURIComponent(albumName)}`
    const document = new JSDOM((await axios.get(url)).data).window.document
    const header = document.querySelector('#firstHeading')
    // 未找到精确匹配, 返回搜索结果
    if (header && header.textContent === '搜索结果') {
      return [...document.querySelectorAll('.mw-search-result-heading a')]
        .map(it => it.textContent!)
        .filter(it => !it.startsWith('歌词:'))
    } else {
      return albumName
    }
  }
  private async getAlbumCover(img: HTMLImageElement) {
    const src = img.src.replace('/thumb/', '/')
    const url = src.substring(0, src.lastIndexOf('/'))
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    return response.data as Buffer
  }
  private getAlbumData(infoTable: Element) {
    const getTableItem = (labelName: string) => {
      const labelElements = [...infoTable.querySelectorAll('.label')]
        .filter(it => it.innerHTML.trim() === labelName)
      if (labelElements.length === 0) {
        return ''
      }
      const [item] = labelElements.map(it => {
        const nextElement = it.nextElementSibling as HTMLElement
        return nextElement.textContent!.trim()
      })
      return item
    }
    const album = getTableItem('名称')
    const albumArtists = getTableItem('制作方').split('\n')
    const genres = getTableItem('风格类型').split('，')
    const year = parseInt(getTableItem('首发日期')).toString()
    return {
      album,
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
        return {
          name,
          result: data.textContent!.trim().split('，')
        }
      }
    }
    const label = trackInfoRow.querySelector('.label')!.textContent!.trim()
    const data = trackInfoRow.querySelector('.text') as HTMLElement
    const actions: { [infoName: string]: (data: HTMLElement) => TrackParseInfo } = {
      编曲: defaultInfoParser('arrangers'),
      作曲: defaultInfoParser('composers'),
      演唱: defaultInfoParser('vocals'),
      演奏: defaultInfoParser('instruments'),
      作词: defaultInfoParser('lyricists'),
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
  private parseRow(trackNumberElement: Element) {
    const trackNumber = parseInt(trackNumberElement.textContent!, 10).toString()
    const trackNumberRow = trackNumberElement.parentElement as HTMLTableRowElement
    const title = trackNumberRow.querySelector('.title')!.textContent!.trim()
    const relatedInfoRows = this.getRelatedRows(trackNumberRow)
    const infos = relatedInfoRows.map(it => this.parseRelatedRowInfo(it))
    const [lyricists] = infos
      .filter(it => it.name === 'lyricists')
      .map(it => it.result as string[])
    const [comments] = infos
      .filter(it => it.name === 'comments')
      .map(it => it.result as string)
    const artists = ['vocals', 'instruments', 'arrangers']
      .flatMap(name => infos
        .filter(it => it.name === name)
        .map(it => it.result as string[])
        .flat())
    const [composers] = infos
      .filter(it => it.name === 'composers')
      .map(it => it.result as string[])
    if (artists.length === 0) {
      artists.push(...composers)
    }
    return {
      title,
      artists: [...new Set(artists)],
      trackNumber,
      comments,
      lyricists,
      composers,
    }
  }
  async getMetadata(albumName: string) {
    const url = `https://thwiki.cc/index.php?search=${encodeURIComponent(albumName)}`
    const response = await axios.get(url)
    const dom = new JSDOM(response.data)
    const document = dom.window.document
    const infoTable = document.querySelector('.doujininfo') as HTMLTableElement
    if (!infoTable) {
      throw new Error('页面不是同人专辑词条')
    }
    const {
      album,
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
          albumArtists,
          genres,
          year,
          coverImage,
          ...this.parseRow(trackNumberElement)
        }
        metadatas.push(metadata)
      }
      discNumber++
    }
    return metadatas
  }
}
export const thbWiki = new THBWiki()