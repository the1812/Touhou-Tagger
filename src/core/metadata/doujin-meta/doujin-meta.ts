import axios from 'axios'

import { MetadataSource } from '../metadata-source.js'
import type { AlbumMetadata, Metadata } from '../metadata.js'
import { expandMetadataInfo } from '../normalize/normalize.js'

const doujinMetaApi = axios.create({
  baseURL: 'https://doujin-meta.vercel.app',
  responseType: 'json',
})

interface DoujinMetaSearchItem {
  id: number
  album: string
  coverUrl: string
}
type DoujinMetaSearchResult = DoujinMetaSearchItem[]
interface DoujinMetaTrack extends Omit<
  Metadata,
  keyof AlbumMetadata | 'comments' | 'lyricLanguage'
> {
  genres?: string[]
  comments?: string | null
  lyricLanguage?: string | null
}
interface DoujinMetaAlbumDetail {
  album: string
  albumOrder: string
  albumArtists: string[]
  genres: string[]
  year: string
  extraData?: Record<string, unknown>
  coverUrl: string
  tracks: DoujinMetaTrack[]
}

export class DoujinMeta extends MetadataSource {
  private readonly albumIds = new Map<string, number>()

  private async search(albumName: string) {
    const { data } = await doujinMetaApi.get<DoujinMetaSearchResult>('/api/albums/search/', {
      params: { keyword: albumName },
    })
    data.forEach(album => this.albumIds.set(album.album, album.id))
    return data
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
      `/api/albums/${albumId}`,
    )
    const downloadCover = async () => {
      const { data: coverData } = await doujinMetaApi.get<Buffer>(albumDetail.coverUrl, {
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
        album: albumDetail.album,
        albumOrder: albumDetail.albumOrder,
        albumArtists: albumDetail.albumArtists,
        genres: track.genres ?? albumDetail.genres,
        year: albumDetail.year,
        extraData: index === 0 ? albumDetail.extraData : undefined,
      })),
      cover: coverBuffer,
    })
  }
}
export const doujinMeta = new DoujinMeta()
