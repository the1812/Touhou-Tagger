import axios from 'axios'

import type { MetadataConfig } from '../../core-config.js'
import { getHttpRequestOptions } from '../../http.js'
import { albumArtistsAltNames } from '../alt-names.js'
import type { AlbumCandidate } from '../metadata-source.js'

interface SearchDetails {
  results: Partial<Record<string, { printouts: Partial<Record<string, { fulltext: string }[]>> }>>
}

interface SearchImages {
  normalized?: { from: string; to: string }[]
  pages: { title: string; imageinfo?: { url: string; thumburl?: string }[] }[]
}

export const loadSearchDetails = async (
  names: string[],
  host: string,
  config: MetadataConfig,
): Promise<AlbumCandidate[]> => {
  if (names.length === 0) {
    return []
  }
  const queryWiki = async <T>(params: Record<string, string>) => {
    const { data } = await axios.get<{ query: T; error?: { code: string; info: string } }>(
      `https://${host}/api.php`,
      { ...getHttpRequestOptions(config), params: { format: 'json', ...params } },
    )
    if (data.error) {
      throw new Error(`THBWiki search details error ${data.error.code}: ${data.error.info}`)
    }
    return data.query
  }
  const details = await queryWiki<SearchDetails>({
    action: 'ask',
    query: `${names.map(name => `[[${name}]]`).join(' OR ')}|?制作方|?封面图片|limit=${String(names.length)}`,
  })
  const candidates = names.map(name => {
    const printouts = details.results[name]?.printouts
    return {
      id: name,
      name,
      artists:
        printouts?.['制作方']?.map(
          artist => albumArtistsAltNames.get(artist.fulltext) ?? artist.fulltext,
        ) ?? [],
    }
  })
  const files = new Map(
    names.map(name => [name, details.results[name]?.printouts['封面图片']?.[0]?.fulltext]),
  )
  const titles = [...new Set([...files.values()].filter(Boolean))]
  if (titles.length === 0) {
    return candidates
  }
  const images = await queryWiki<SearchImages>({
    action: 'query',
    formatversion: '2',
    prop: 'imageinfo',
    titles: titles.join('|'),
    iiprop: 'url',
    iiurlwidth: '500',
    iiurlheight: '500',
  })
  const urls = new Map(
    images.pages.map(page => {
      const info = page.imageinfo?.[0]
      return [page.title, info?.thumburl || info?.url]
    }),
  )
  images.normalized?.forEach(({ from, to }) => urls.set(from, urls.get(to)))
  return candidates.map(candidate => ({
    ...candidate,
    thumbnailUrl: urls.get(files.get(candidate.id) ?? ''),
  }))
}
