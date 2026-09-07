import axios from 'axios'

import { MetadataSource } from '../metadata-source.js'
import type { AlbumMetadata, Metadata } from '../metadata.js'
import { expandMetadataInfo } from '../normalize/normalize.js'

const doujinMetaApi = axios.create({
  baseURL: 'https://doujin-meta.vercel.app',
  responseType: 'json',
})

interface DoujinMetaSearchItem {
  id: string
  album: string
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

  private async search(albumName: string) {
    const { data } = await doujinMetaApi.get<DoujinMetaSearchResult>('/api/albums', {
      params: { keyword: albumName, limit: MetadataSource.MaxSearchCount },
    })
    data.items.forEach(album => this.albumIds.set(album.album, album.id))
    return data.items
  }

  async resolveAlbumName(albumName: string): Promise<string | string[]> {
    const searchResult = await this.search(albumName)
    if (searchResult.length > 0 && searchResult[0].album === albumName) {
      return albumName
    }
    return searchResult.map(it => it.album).slice(0, MetadataSource.MaxSearchCount)
  }

  async getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]> {
    if (!this.albumIds.has(albumName)) {
      await this.search(albumName)
    }
    const albumId = this.albumIds.get(albumName)
    if (albumId === undefined) {
      throw new Error(`Doujin Meta album not found: ${albumName}`)
    }
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
    const coverBuffer = cover ?? (await downloadCover())

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
