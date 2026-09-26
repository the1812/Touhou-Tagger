import type { MetadataConfig } from '../../core-config.js'
import { log } from '../../debug.js'
import { altNames } from '../alt-names.js'
import type { Metadata } from '../metadata.js'
import { parseRelatedRowInfo } from './thb-wiki-row-info.js'

const getRelatedRows = (trackNumberRow: Element): Element[] => {
  const nextElement = trackNumberRow.nextElementSibling
  if (nextElement === null || nextElement.querySelector('.left') === null) {
    return []
  }
  return [nextElement, ...getRelatedRows(nextElement)]
}
const rowDataNormalize = <T extends Partial<Metadata>>(
  rowData: T,
  removePatterns: RegExp[] = [],
) => {
  const normalizeAction = (str: string) => {
    if (altNames.has(str)) {
      return altNames.get(str)
    }
    return (
      removePatterns
        .reduce((previous, current) => previous.replace(current, ''), str)
        .replace(/\u200b/g, '') // zero-width space
        // oxlint-disable-next-line no-irregular-whitespace
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
      Object.assign(rowData, { [key]: normalizeAction(value) })
    }
    if (Array.isArray(value)) {
      Object.assign(rowData, { [key]: [...new Set(value.map(v => normalizeAction(v)))] })
    }
  }
  return rowData
}
export const parseTrackRow = async (
  trackNumberElement: Element,
  host: string,
  config: MetadataConfig,
) => {
  const trackNumber = parseInt(trackNumberElement.textContent).toString()
  const trackNumberRow = trackNumberElement.parentElement as HTMLTableRowElement
  const title = (trackNumberRow.querySelector('.title') as HTMLElement).textContent.trim()
  const { lyricLanguage, lyric } = await (async () => {
    const lyricLink = trackNumberRow.querySelector<HTMLAnchorElement>(
      ':not(.new) > a:not(.external)',
    )
    if (config.lyric && lyricLink) {
      const { downloadLyrics } = await import('./lyrics/thb-wiki-lyrics.js')
      return downloadLyrics(
        `https://${host}${lyricLink.href}`,
        title,
        config as MetadataConfig & { lyric: NonNullable<MetadataConfig['lyric']> },
      )
    }
    return {
      lyric: undefined,
      lyricLanguage: undefined,
    }
  })()
  const relatedInfoRows = getRelatedRows(trackNumberRow)
  const infos = relatedInfoRows.map(it => parseRelatedRowInfo(it))
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
  const composers = infos.find(it => it.name === 'composers')?.result as string[] | undefined
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
    ...rowDataNormalize(artistsRowData, [/（.+）$/]),
    ...rowDataNormalize(otherRowData),
  }
  log(rowData)
  return rowData
}
