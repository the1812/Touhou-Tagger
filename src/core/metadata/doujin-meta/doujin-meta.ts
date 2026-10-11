import axios from 'axios'

import { defaultUserAgent } from '../../http.js'
import { MetadataFetchOptions, MetadataSource } from '../metadata-source.js'
import type { AlbumMetadata, Metadata } from '../metadata.js'
import { expandMetadataInfo } from '../normalize/normalize.js'

const doujinMetaApi = axios.create({
  baseURL: 'https://doujin-meta.vercel.app',
  headers: { 'User-Agent': defaultUserAgent },
  responseType: 'json',
})

interface DoujinMetaSearchItem {
  id: string
  album: string
  links: { cover?: string }
}
interface DoujinMetaSearchResult {
  items: DoujinMetaSearchItem[]
}
interface DoujinMetaTrack extends Omit<
  Metadata,
  keyof AlbumMetadata | 'comments' | 'lyricLanguage' | 'lyric' | 'bpm' | 'key'
> {
  genres?: string[]
  comments?: string | null
  lyricLanguage?: string | null
  lyric?: string | null
  bpm?: string | null
  key?: string | null
}
interface DoujinMetaAlbumDetail {
  album: string
  albumOrder: string | null
  albumArtists: string[]
  genres: string[]
  year: string | null
  extraData: Record<string, unknown> | null
  links: { cover?: string }
  tracks: DoujinMetaTrack[]
}

export class DoujinMeta extends MetadataSource {
  private readonly albumIds = new Map<string, string>()

  async search(albumName: string) {
    const { data } = await doujinMetaApi.get<DoujinMetaSearchResult>('/api/albums', {
      params: { keyword: albumName, limit: MetadataSource.MaxSearchCount },
    })
    data.items.forEach(album => this.albumIds.set(album.album, album.id))
    return data.items.slice(0, MetadataSource.MaxSearchCount).map(item => ({
      id: item.id,
      name: item.album,
      thumbnailUrl: item.links.cover
        ? new URL(item.links.cover, doujinMetaApi.defaults.baseURL).href
        : undefined,
    }))
  }

  async resolveAlbumName(albumName: string): Promise<string | string[]> {
    const candidates = await this.search(albumName)
    const first = candidates.at(0)
    if (
      first &&
      first.name.normalize('NFKC').toLowerCase().trim() ===
        albumName.normalize('NFKC').toLowerCase().trim()
    ) {
      return first.name
    }
    return candidates.map(candidate => candidate.name)
  }

  async getMetadata(albumName: string, options: MetadataFetchOptions = {}): Promise<Metadata[]> {
    if (!this.albumIds.has(albumName)) {
      await this.search(albumName)
    }
    const albumId = this.albumIds.get(albumName)
    if (albumId === undefined) {
      throw new Error(`Doujin Meta album not found: ${albumName}`)
    }
    return this.getMetadataById(albumId, options)
  }

  async getMetadataById(albumId: string, options: MetadataFetchOptions = {}): Promise<Metadata[]> {
    const { data: albumDetail } = await doujinMetaApi.get<DoujinMetaAlbumDetail>(
      `/api/albums/${encodeURIComponent(albumId)}`,
    )
    const downloadCover = async () => {
      if (!albumDetail.links.cover) {
        return undefined
      }
      const { data: coverData } = await doujinMetaApi.get<Buffer>(albumDetail.links.cover, {
        responseType: 'arraybuffer',
      })
      return coverData
    }
    const coverBuffer =
      options.cover ?? (options.downloadCover === false ? undefined : await downloadCover())

    return expandMetadataInfo({
      metadatas: albumDetail.tracks.map((track, index) => ({
        ...track,
        comments: track.comments ?? undefined,
        lyricLanguage: track.lyricLanguage ?? undefined,
        lyric: track.lyric ?? undefined,
        bpm: track.bpm ?? undefined,
        key: track.key ?? undefined,
        album: albumDetail.album,
        albumOrder: albumDetail.albumOrder ?? '',
        albumArtists: albumDetail.albumArtists,
        genres: track.genres ?? albumDetail.genres,
        year: albumDetail.year ?? undefined,
        extraData: index === 0 ? (albumDetail.extraData ?? undefined) : undefined,
      })),
      cover: coverBuffer,
    })
  }
}
export const doujinMeta = new DoujinMeta()
