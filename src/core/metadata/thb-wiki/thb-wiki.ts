import axios from 'axios'
import { parseHTML } from 'linkedom'

import { getHttpRequestOptions } from '../../http.js'
import { albumArtistsAltNames } from '../alt-names.js'
import { MetadataFetchOptions, MetadataSource } from '../metadata-source.js'
import { Metadata } from '../metadata.js'
import { loadSearchDetails } from './search.js'
import { parseTrackRow } from './thb-wiki-track.js'

type ParseResponse = {
  parse?: {
    text?: string
  }
  error?: {
    code?: string
    info?: string
  }
}

export class ThbWiki extends MetadataSource {
  constructor(public readonly host = 'thwiki.cc') {
    super()
  }

  async search(albumName: string) {
    const url = `https://${
      this.host
    }/api.php?action=opensearch&format=json&formatversion=2&search=${encodeURIComponent(
      albumName,
    )}&limit=${String(MetadataSource.MaxSearchCount)}&suggest=true`
    const response = await axios.get<[string, string[]]>(url, {
      ...getHttpRequestOptions(this.config),
      responseType: 'json',
    })
    if (response.status === 200 && Array.isArray(response.data)) {
      const [, names] = response.data
      const filteredNames = names.filter(it => !it.startsWith('歌词:'))
      return loadSearchDetails(filteredNames, this.host, this.config)
    }
    return []
  }
  private async getAlbumCover(img: HTMLImageElement) {
    const src = img.src.replace('/thumb/', '/')
    const url = src.substring(0, src.lastIndexOf('/'))
    const response = await axios.get(url, {
      ...getHttpRequestOptions(this.config),
      responseType: 'arraybuffer',
    })
    return response.data as Buffer
  }
  private getAlbumData(infoTable: Element) {
    function getTableItem(labelName: string): string
    function getTableItem(labelName: string, multiple: true): string[]
    function getTableItem(labelName: string, multiple = false) {
      const labelElements = [...infoTable.querySelectorAll('.label')].filter(
        it => it.innerHTML.trim() === labelName,
      )
      if (labelElements.length === 0) {
        return ''
      }
      const [item] = labelElements.map(it => {
        const nextElement = it.nextElementSibling as HTMLElement
        if (multiple) {
          return [...nextElement.querySelectorAll('a')].map(element => element.textContent)
        }
        return nextElement.textContent.trim()
      })
      return item
    }
    const album = getTableItem('名称')
    const albumOrder = getTableItem('编号')
    const albumArtists = getTableItem('制作方', true)
    const genre = getTableItem('风格类型')
    const genres = genre ? genre.split('，') : []
    const year = parseInt(getTableItem('首发日期'))
    const replaceAltNames = (str: string) => {
      return albumArtistsAltNames.get(str) ?? str
    }
    return {
      album,
      albumOrder,
      albumArtists: albumArtists.map(it => replaceAltNames(it)),
      genres,
      year: Number.isNaN(year) ? undefined : year.toString(),
    }
  }
  async getMetadataFromHtml(html: string, options: MetadataFetchOptions = {}) {
    const { document } = parseHTML(html).window
    const infoTable = document.querySelector<HTMLTableElement>('.doujininfo')
    if (!infoTable) {
      throw new Error('页面不是同人专辑词条')
    }
    const { album, albumOrder, albumArtists, genres, year } = this.getAlbumData(infoTable)
    const coverImageElement = document.querySelector<HTMLImageElement>('.cover-artwork img')
    const coverImage = await (async () => {
      if (options.cover) {
        return options.cover
      }
      if (options.downloadCover === false) {
        return undefined
      }
      if (coverImageElement) {
        return this.getAlbumCover(coverImageElement)
      }
      return undefined
    })()

    const musicTables = [...document.querySelectorAll('.musicTable')] as HTMLTableElement[]
    let discNumber = 1
    const metadatas = [] as Metadata[]
    // const getAlbumOrder = (disc: number) => {
    //   const splitAlbumOrders = albumOrder.split(/\s\+\s/)
    //   if (disc > splitAlbumOrders.length) {
    //     return splitAlbumOrders[splitAlbumOrders.length - 1]
    //   }
    //   return splitAlbumOrders[disc - 1]
    // }
    for (const table of musicTables) {
      const trackNumbers = [
        ...table.querySelectorAll('tr > td[class^="info"]'),
      ] as HTMLTableCellElement[]
      for (const trackNumberElement of trackNumbers) {
        const metadata = {
          discNumber: discNumber.toString(),
          album,
          albumOrder,
          // albumOrder: getAlbumOrder(discNumber),
          albumArtists,
          genres,
          year,
          coverImage,
          ...(await parseTrackRow(trackNumberElement, this.host, this.config)),
        }
        metadatas.push(metadata)
      }
      discNumber += 1
    }
    return metadatas
  }

  async getMetadata(albumName: string, options: MetadataFetchOptions = {}) {
    const url = `https://${this.host}/api.php?action=parse&format=json&formatversion=2&page=${encodeURIComponent(
      albumName,
    )}&prop=text`
    const response = await axios.get<ParseResponse>(url, {
      ...getHttpRequestOptions(this.config),
      responseType: 'json',
    })
    if (response.data.error) {
      throw new Error(
        `THBWiki API 错误 ${response.data.error.code ?? ''}: ${response.data.error.info ?? ''}`.trim(),
      )
    }
    const html = response.data.parse?.text
    if (!html) {
      throw new Error('THBWiki API 未返回 HTML 内容')
    }
    return this.getMetadataFromHtml(html, options)
  }
}
export const thbWiki = new ThbWiki()
