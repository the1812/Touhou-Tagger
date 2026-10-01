import axios from 'axios'

import { createRateLimitedClient, getHttpRequestOptions } from '../../http.js'
import { MetadataSource, type MetadataFetchOptions } from '../metadata-source.js'
import type { Metadata } from '../metadata.js'
import { expandMetadataInfo } from '../normalize/normalize.js'

const api = createRateLimitedClient('https://api.discogs.com', 3000)

interface Artist {
  name: string
  anv?: string
  role?: string
  tracks?: string
}
interface Track {
  position: string
  type_: string
  title: string
  artists?: Artist[]
  extraartists?: Artist[]
  sub_tracks?: Track[]
}
interface Release {
  title: string
  year?: number
  artists?: Artist[]
  extraartists?: Artist[]
  labels?: { name: string; catno: string }[]
  genres?: string[]
  styles?: string[]
  tracklist: Track[]
  images?: { type: string; uri: string }[]
}
interface SearchItem {
  cover_image?: string
  label?: string[]
  id: number
  title: string
  year?: string
  country?: string
  catno?: string
  format?: string[]
}

const entityName = (name: string) => name.replace(/ \(\d+\)$/, '')
const artistName = (artist: Artist) => artist.anv || entityName(artist.name)

const appliesToTrack = (scope: string | undefined, position: string, positions: string[]) => {
  if (!scope?.trim()) {
    return true
  }
  return scope.split(',').some(part => {
    const range = part.trim().split(/\s+to\s+/i)
    if (range.length === 1) {
      return range[0] === position
    }
    const start = positions.indexOf(range[0])
    const end = positions.indexOf(range[1])
    const index = positions.indexOf(position)
    return start >= 0 && end >= start && index >= start && index <= end
  })
}

const creditNames = (credits: Artist[], roles: string[]) => [
  ...new Set(
    credits
      .filter(artist =>
        artist.role
          ?.replace(/\[[^\]]*\]/g, '')
          .split(',')
          .some(role => roles.includes(role.trim().toLowerCase())),
      )
      .map(artistName),
  ),
]

export class Discogs extends MetadataSource {
  async search(query: string) {
    const { data } = await api.get<{ results: SearchItem[] }>('/database/search', {
      ...getHttpRequestOptions(this.config),
      params: { q: query, type: 'release', format: 'CD', per_page: MetadataSource.MaxSearchCount },
    })
    return data.results.map(release => {
      const separator = release.title.indexOf(' - ')
      const labels = [...new Set(release.label?.map(entityName))]
      return {
        id: String(release.id),
        name: separator < 0 ? release.title : release.title.slice(separator + 3),
        artists: labels,
        thumbnailUrl: release.cover_image || undefined,
        description: [
          labels.join(' / '),
          release.year,
          release.catno,
          release.country,
          release.format?.join(' / '),
          String(release.id),
        ]
          .filter(Boolean)
          .join(' · '),
      }
    })
  }

  async getMetadata(id: string, options: MetadataFetchOptions = {}): Promise<Metadata[]> {
    const { data: release } = await api.get<Release>(
      `/releases/${encodeURIComponent(id)}`,
      getHttpRequestOptions(this.config),
    )
    const tracks = release.tracklist.filter(track => track.type_ !== 'heading')
    if (!tracks.length) {
      throw new Error(`Discogs release ${id} has no audio tracks`)
    }
    const positions = tracks.map(track => track.position)
    const albumArtists = [...new Set(release.labels?.map(label => entityName(label.name)))]
    const metadata = tracks.map(track => {
      const position = /^(?:(?:CD)?(\d+)[-.])?(\d+)$/i.exec(track.position)
      if (!position || track.type_ !== 'track' || track.sub_tracks?.length) {
        throw new Error(
          `Discogs release ${id} has an unsupported track position or index: ${track.position || track.title}`,
        )
      }
      const credits = (release.extraartists ?? [])
        .filter(artist => appliesToTrack(artist.tracks, track.position, positions))
        .concat(track.extraartists ?? [])
      const artists = (track.artists?.length ? track.artists : (release.artists ?? [])).map(
        artistName,
      )
      return {
        album: release.title,
        albumOrder: [
          ...new Set(
            release.labels
              ?.map(label => label.catno)
              .filter(catno => catno && catno.toLowerCase() !== 'none'),
          ),
        ].join(' / '),
        albumArtists,
        year: release.year ? String(release.year) : undefined,
        title: track.title,
        discNumber: String(Number(position[1] || '1')),
        trackNumber: String(Number(position[2])),
        artists,
        composers: creditNames(credits, ['composed by', 'music by']),
        lyricists: creditNames(credits, ['lyrics by', 'words by']),
        genres: [...new Set([...(release.genres ?? []), ...(release.styles ?? [])])],
      }
    })
    if (
      new Set(metadata.map(track => `${track.discNumber}-${track.trackNumber}`)).size !==
      metadata.length
    ) {
      throw new Error(`Discogs release ${id} has duplicate track positions`)
    }
    let { cover } = options
    const image = release.images?.find(item => item.type === 'primary') ?? release.images?.[0]
    if (!cover && options.downloadCover !== false && image?.uri) {
      const { data } = await axios.get<Buffer>(image.uri, {
        ...getHttpRequestOptions(this.config),
        responseType: 'arraybuffer',
      })
      cover = data
    }
    return expandMetadataInfo({ metadatas: metadata, cover })
  }
}

export const discogs = new Discogs()
