import Axios from 'axios'
import { LocalJsonPlugin } from './local-json'

/** 处理封面图片 */
export const fetchCoverPlugin: LocalJsonPlugin = ({ cover, config }) => {
  let firstCoverBuffer: Buffer | undefined = undefined
  const downloadRemoteCover = async (url: string) => {
    return Axios.get<Buffer>(url, {
      responseType: 'arraybuffer',
      timeout: config.timeout * 1000,
    })
  }
  return async ({ metadata, index }) => {
    if (index === 0) {
      if (cover !== undefined) {
        firstCoverBuffer = cover
      } else if (typeof metadata.coverImage === 'string') {
        const response = await downloadRemoteCover(metadata.coverImage)
        firstCoverBuffer = response.data
      }
      metadata.coverImage = firstCoverBuffer
    }
    if (index > 0) {
      if (metadata.coverImage === undefined && firstCoverBuffer !== undefined) {
        metadata.coverImage = firstCoverBuffer
      } else if (typeof metadata.coverImage === 'string') {
        const response = await downloadRemoteCover(metadata.coverImage)
        metadata.coverImage = response.data
      }
    }
  }
}