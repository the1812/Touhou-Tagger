import axios from 'axios'

import { createRateLimitedClient, getHttpRequestOptions } from '../../http.js'
import { MetadataSource, type MetadataFetchOptions } from '../metadata-source.js'
import type { Metadata } from '../metadata.js'
import { expandMetadataInfo } from '../normalize/normalize.js'

const api = createRateLimitedClient('https://musicbrainz.org/ws/2', 1100)

interface ArtistCredit {
  name?: string
  artist: { name: string }
}
interface Relation {
  type: string
  'target-credit'?: string
  artist?: { name: string }
  work?: { relations?: Relation[] }
}
interface Recording {
  title: string
  video?: boolean
  'artist-credit'?: ArtistCredit[]
  genres?: { name: string }[]
  relations?: Relation[]
}
interface Release {
  id: string
  title: string
  date?: string
  country?: string
  disambiguation?: string
  'artist-credit'?: ArtistCredit[]
  'label-info'?: { 'catalog-number'?: string }[]
  genres?: { name: string }[]
  'cover-art-archive'?: { front: boolean }
  media?: {
    position: number
    format?: string
    tracks?: {
      position: number
      title: string
      'artist-credit'?: ArtistCredit[]
      recording: Recording
    }[]
  }[]
}

const artistNames = (credits: ArtistCredit[] = []) =>
  credits.map(credit => credit.name || credit.artist.name)

const catalogNumbers = (release: Release) =>
  [...new Set(release['label-info']?.map(label => label['catalog-number']).filter(Boolean))].join(
    ' / ',
  )

const creditNames = (relations: Relation[], role: string) => [
  ...new Set(
    relations.flatMap(relation =>
      relation.type === role && relation.artist
        ? [relation['target-credit'] || relation.artist.name]
        : [],
    ),
  ),
]

export class MusicBrainz extends MetadataSource {
  async search(query: string) {
    const phrase = `"${query.replace(/["\\]/g, '\\$&')}"`
    const { data } = await api.get<{ releases: Release[] }>('/release', {
      ...getHttpRequestOptions(this.config),
      params: {
        query: `release:${phrase} OR catno:${phrase}`,
        limit: MetadataSource.MaxSearchCount,
        fmt: 'json',
      },
    })
    return data.releases.map(release => ({
      id: release.id,
      name: release.title,
      artists: artistNames(release['artist-credit']),
      thumbnailUrl: `https://coverartarchive.org/release/${encodeURIComponent(release.id)}/front-500`,
      description: [
        artistNames(release['artist-credit']).join(' / '),
        release.date,
        catalogNumbers(release),
        release.country,
        [...new Set(release.media?.map(medium => medium.format).filter(Boolean))].join(' / '),
        release.disambiguation,
        release.id,
      ]
        .filter(Boolean)
        .join(' · '),
    }))
  }

  async getMetadata(id: string, options: MetadataFetchOptions = {}): Promise<Metadata[]> {
    const { data: release } = await api.get<Release>(`/release/${encodeURIComponent(id)}`, {
      ...getHttpRequestOptions(this.config),
      params: {
        fmt: 'json',
        inc: 'recordings+artist-credits+labels+genres+recording-level-rels+work-level-rels+work-rels+artist-rels',
      },
    })
    const albumArtists = artistNames(release['artist-credit'])
    const metadata = (release.media ?? []).flatMap(medium =>
      (medium.tracks ?? [])
        .filter(track => !track.recording.video)
        .map(track => {
          const { recording } = track
          const relations = recording.relations ?? []
          const credits = relations.concat(
            relations.flatMap(relation => relation.work?.relations ?? []),
          )
          const artists = artistNames(track['artist-credit'] ?? recording['artist-credit'])
          const genres = recording.genres?.length ? recording.genres : release.genres
          return {
            album: release.title,
            albumOrder: catalogNumbers(release),
            albumArtists,
            year: release.date?.slice(0, 4),
            title: track.title || recording.title,
            discNumber: String(medium.position),
            trackNumber: String(track.position),
            artists: artists.length ? artists : albumArtists,
            composers: creditNames(credits, 'composer'),
            lyricists: creditNames(credits, 'lyricist'),
            genres: genres?.map(genre => genre.name),
          }
        }),
    )
    if (!metadata.length) {
      throw new Error(`MusicBrainz release ${id} has no audio tracks`)
    }
    let { cover } = options
    if (!cover && options.downloadCover !== false && release['cover-art-archive']?.front) {
      const response = await axios.get<Buffer>(
        `https://coverartarchive.org/release/${encodeURIComponent(id)}/front`,
        {
          ...getHttpRequestOptions(this.config),
          responseType: 'arraybuffer',
          validateStatus: status => status === 404 || (status >= 200 && status < 300),
        },
      )
      if (response.status !== 404) {
        cover = response.data
      }
    }
    return expandMetadataInfo({ metadatas: metadata, cover })
  }
}

export const musicBrainz = new MusicBrainz()
