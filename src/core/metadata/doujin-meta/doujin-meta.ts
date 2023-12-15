import axios from 'axios'
import fuse from 'fuse.js'
import { Metadata } from '../metadata'
import { MetadataSource } from '../metadata-source'
import { expandMetadataInfo } from '../normalize/normalize'

const doujinMetaApi = axios.create({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  baseURL: 'https://doujin-meta.vercel.app',
  responseType: 'json',
})

interface DoujinMetaSearchItem {
  id: string
  name: string
  coverUrl: string
  detailUrl: string
  matches: fuse.RangeTuple[]
}
type DoujinMetaSearchResult = DoujinMetaSearchItem[]
interface DoujinMetaAlbumDetail {
  name: string
  coverUrl: string
  metadata: Metadata[]
  metadataUrl: string
  rawUrl: string
}

export class DoujinMeta extends MetadataSource {
  async resolveAlbumName(albumName: string): Promise<string | string[]> {
    const { data: searchResult } = await doujinMetaApi.get<DoujinMetaSearchResult>(
      `/api/albums/search/${albumName}`,
    )
    if (searchResult.length > 0 && searchResult[0].name === albumName) {
      return albumName
    }
    return searchResult.map(it => it.name).slice(0, MetadataSource.MaxSearchCount)
  }

  async getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]> {
    const { data: albumDetail } = await doujinMetaApi.get<DoujinMetaAlbumDetail>(
      `/api/albums/detail/${albumName}`,
    )
    const downloadCover = async () => {
      const { data: coverData } = await doujinMetaApi.get<Buffer>(albumDetail.coverUrl, {
        responseType: 'arraybuffer',
      })
      return coverData
    }
    const coverBuffer = cover ?? (await downloadCover())

    return expandMetadataInfo({
      metadatas: albumDetail.metadata,
      cover: coverBuffer,
    })
  }
}
export const doujinMeta = new DoujinMeta()
