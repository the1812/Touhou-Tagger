import axios from 'axios'
import { parseHTML } from 'linkedom'
import { MetadataSource } from '../metadata-source'
import { Metadata } from '../metadata'
import { log } from '../../debug'
import { MetadataConfig } from '../../core-config'
import { albumArtistsAltNames, altNames } from '../alt-names'

const isNodeAnElement = <TargetType extends Element>(
  node: Node,
  tagName: string,
): node is TargetType => {
  // Node.ELEMENT_NODE === 1
  return node.nodeType === 1 && (node as Element).tagName.toLowerCase() === tagName
}
const splitChildNodesByBr = (element: Element) => {
  const result: ChildNode[][] = []
  const allNodes = [...element.childNodes]
  let startIndex = 0
  allNodes.forEach((node, index) => {
    if (isNodeAnElement(node, 'br')) {
      const slice = allNodes.slice(startIndex, index)
      result.push(slice)
      startIndex = index + 1
    }
  })
  result.push(allNodes.slice(startIndex))
  return result
}
type TrackParseInfo = { name: string; result: string | string[] }

export class ThbWiki extends MetadataSource {
  constructor(public readonly host = 'thbwiki.cc') {
    super()
  }

  async resolveAlbumName(albumName: string) {
    const url = `https://${
      this.host
    }/api.php?action=opensearch&format=json&formatversion=2&search=${encodeURIComponent(
      albumName,
    )}&limit=${MetadataSource.MaxSearchCount}&suggest=true`
    const response = await axios.get(url, {
      responseType: 'json',
      timeout: this.config.timeout * 1000,
    })
    if (response.status === 200 && Array.isArray(response.data) && response.data.length > 1) {
      const [, names] = response.data
      const [name] = (names as string[]).filter(it => !it.startsWith('歌词:'))
      if (name === albumName) {
        return name
      }
      return names as string[]
    }
    return []
  }
  private async getAlbumCover(img: HTMLImageElement) {
    const src = img.src.replace('/thumb/', '/')
    const url = src.substring(0, src.lastIndexOf('/'))
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: this.config.timeout * 1000,
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
    const genres = getTableItem('风格类型').split('，')
    const year = parseInt(getTableItem('首发日期'))
    const replaceAltNames = (str: string) => {
      if (albumArtistsAltNames.has(str)) {
        return albumArtistsAltNames.get(str)
      }
      return str
    }
    return {
      album,
      albumOrder,
      albumArtists: albumArtists.map(it => replaceAltNames(it)),
      genres,
      year: Number.isNaN(year) ? undefined : year.toString(),
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
    const replaceSinglePrefix = (data: string) => {
      const match = data.match(/^(.+?)：(.+)$/)
      if (match) {
        return match[2]
      }
      return data
    }
    const defaultInfoParser = (name: string): ((data: Element) => TrackParseInfo) => {
      return (data: Element) => {
        const children = [...data.children]
        const brIndex = children.findIndex(it => it.tagName.toLowerCase() === 'br')
        if (brIndex !== -1) {
          children.slice(brIndex).forEach(e => e.remove())
        }
        let { textContent } = data
        /*
          要是这个值就是一个_, THBWiki 会转成一个警告...
          例如疯帽子茶会'千年战争'中出现的编曲者就有一个_ (现已更名为'底线')
          https://thwiki.cc/%E5%8D%83%E5%B9%B4%E6%88%98%E4%BA%89%EF%BD%9Eiek_loin_staim_haf_il_dis_o-del_al
        */
        const warningMatch = textContent.match(
          /包含无效字符或不完整，并因此在查询或注释过程期间导致意外结果。\[\[(.+)\]\]/,
        )
        if (warningMatch) {
          textContent = warningMatch[1]
        }
        return {
          name,
          result: textContent
            .trim()
            .split('，')
            .map(it => replaceSinglePrefix(it)),
        }
      }
    }
    const isSequence = (data: Element) => {
      return [...data.childNodes].some(node => isNodeAnElement(node, 'br'))
    }

    const label = trackInfoRow.querySelector('.label').textContent.trim()
    const rawData = trackInfoRow.querySelector('.text') as HTMLElement
    const actions: { [infoName: string]: (data: HTMLElement) => TrackParseInfo } = {
      编曲: defaultInfoParser('arrangers'),
      再编曲: defaultInfoParser('remix'),
      作曲: defaultInfoParser('composers'),
      剧本: defaultInfoParser('scripts'),
      演唱: defaultInfoParser('vocals'),
      翻唱: defaultInfoParser('coverVocals'),
      和声: defaultInfoParser('harmonyVocals'),
      伴唱: defaultInfoParser('accompanyVocals'),
      合唱: defaultInfoParser('chorusVocals'),
      // 演奏: defaultInfoParser('instruments'),
      作词: defaultInfoParser('lyricists'),
      配音: data => {
        const name = 'voices'
        if (!isSequence(data)) {
          return defaultInfoParser(name)(data)
        }
        const slices = splitChildNodesByBr(data)
        const rows = slices.flatMap(it => {
          const anchors = it.filter((a): a is HTMLAnchorElement => isNodeAnElement(a, 'a'))
          const artists = anchors.map(a => {
            const isRealArtist =
              a.previousSibling &&
              a.previousSibling.textContent === '（' &&
              a.nextSibling &&
              a.nextSibling.textContent === '）'
            if (isRealArtist) {
              return a.textContent
            }
            return ''
          })
          if (artists.every(a => a === '')) {
            return anchors.map(a => a.textContent.trim())
          }
          return artists.filter(a => a !== '').map(a => a.trim())
        })
        return {
          name,
          result: rows,
        }
      },
      演奏: data => {
        const name = 'instruments'
        if (!isSequence(data)) {
          return defaultInfoParser(name)(data)
        }
        const slices = splitChildNodesByBr(data)
        const rows = slices
          .map(it => {
            const [instrumentOrPerformer, performer] = (it as [ChildNode, HTMLAnchorElement]).map(
              row => row.textContent,
            )
            const result = performer || instrumentOrPerformer
            const sequenceIndex = result.indexOf('：')
            if (sequenceIndex !== -1) {
              return result.substring(sequenceIndex + 1)
            }
            return result
          })
          .flatMap(row => row.split('，'))
          .map(it => it.trim())
        return {
          name,
          result: rows,
        }
      },
      原曲: data => {
        let result = `原曲: `
        const sources = [...data.querySelectorAll('.ogmusic,.source')] as Element[]
        sources.forEach((element, index) => {
          const comma = ', '
          if (element.classList.contains('ogmusic')) {
            result += element.textContent.trim()
            // 后面还有原曲时加逗号
            if (index < sources.length - 1 && sources[index + 1].classList.contains('ogmusic')) {
              result += comma
            }
          } else {
            // .source
            result += ` (${element.textContent.trim()})`
            // 不是最后一个source时加逗号
            if (index !== sources.length - 1) {
              result += comma
            }
          }
        })
        return {
          name: 'comments',
          result,
        }
      },
    }
    const action = actions[label]
    if (!action) {
      return { name: 'other', result: '' }
    }
    return action(rawData)
  }
  private rowDataNormalize(rowData: Partial<Metadata>, removePatterns: RegExp[] = []) {
    const normalizeAction = (str: string) => {
      if (altNames.has(str)) {
        return altNames.get(str)
      }
      return (
        removePatterns
          .reduce((previous, current) => previous.replace(current, ''), str)
          .replace(/\u200b/g, '') // zero-width space
          // eslint-disable-next-line no-irregular-whitespace
          .replace(/　/g, ' ')
          .replace(/([^\s])([(])/g, '$1 $2')
          .replace(/([)])([^\s])/g, '$1 $2')
          .replace(/([^\s]) ([（])/g, '$1$2')
          .replace(/([）]) ([^\s])/g, '$1$2')
          .replace(/’/g, "'")
          .trim()
      )
    }
    for (const [key, value] of Object.entries(rowData)) {
      if (typeof value === 'string') {
        rowData[key] = normalizeAction(value)
      }
      if (Array.isArray(value)) {
        rowData[key] = value.map(v => normalizeAction(v))
      }
    }
    return rowData
  }
  private async parseRow(trackNumberElement: Element) {
    const trackNumber = parseInt(trackNumberElement.textContent).toString()
    const trackNumberRow = trackNumberElement.parentElement as HTMLTableRowElement
    const title = trackNumberRow.querySelector('.title').textContent.trim()
    const { lyricLanguage, lyric } = await (async () => {
      const lyricLink = trackNumberRow.querySelector(
        ':not(.new) > a:not(.external)',
      ) as HTMLAnchorElement
      if (this.config.lyric && lyricLink) {
        const { downloadLyrics } = await import('./lyrics/thb-wiki-lyrics')
        return downloadLyrics(
          `https://${this.host}${lyricLink.href}`,
          title,
          this.config as Required<MetadataConfig>,
        )
      }
      return {
        lyric: undefined,
        lyricLanguage: undefined,
      }
    })()
    const relatedInfoRows = this.getRelatedRows(trackNumberRow)
    const infos = relatedInfoRows.map(it => this.parseRelatedRowInfo(it))
    const [lyricists] = infos.filter(it => it.name === 'lyricists').map(it => it.result as string[])
    const [comments] = infos.filter(it => it.name === 'comments').map(it => it.result as string)
    const arrangers = ['remix', 'arrangers', 'scripts'].flatMap(name =>
      infos.filter(it => it.name === name).flatMap(it => it.result as string[]),
    )
    const performers = [
      'vocals',
      'coverVocals',
      'harmonyVocals',
      'accompanyVocals',
      'chorusVocals',
      'instruments',
      'voices',
    ].flatMap(name => infos.filter(it => it.name === name).flatMap(it => it.result as string[]))
    const [composers] = infos.filter(it => it.name === 'composers').map(it => it.result as string[])
    // log('artists:', artists)
    if (arrangers.length === 0 && composers) {
      arrangers.push(...composers)
    }
    const artists = [...new Set(performers.concat(arrangers))]
    const artistsRowData = {
      artists,
      lyricists,
      composers,
    }
    const otherRowData = {
      title,
      trackNumber,
      comments,
      lyric,
      lyricLanguage,
    }
    const rowData = {
      ...this.rowDataNormalize(artistsRowData, [/（.+）$/]),
      ...this.rowDataNormalize(otherRowData),
    } as Metadata
    log(rowData)
    return rowData
  }
  async getMetadata(albumName: string, cover?: Buffer) {
    // const url = `https://${this.host}/index.php?search=${encodeURIComponent(albumName)}`
    const url = `https://${this.host}/${encodeURIComponent(albumName)}`
    const response = await axios.get(url, { timeout: this.config.timeout * 1000 })
    const { document } = parseHTML(response.data).window
    const infoTable = document.querySelector('.doujininfo') as HTMLTableElement
    if (!infoTable) {
      throw new Error('页面不是同人专辑词条')
    }
    const { album, albumOrder, albumArtists, genres, year } = this.getAlbumData(infoTable)
    const coverImageElement = document.querySelector('.cover-artwork img') as HTMLImageElement
    const coverImage = await (async () => {
      if (cover) {
        return cover
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
          ...(await this.parseRow(trackNumberElement)),
        }
        metadatas.push(metadata)
      }
      discNumber += 1
    }
    return metadatas
  }
}
export const thbWiki = new ThbWiki()
