import { MetadataNormalizePlugin } from './normalize'

/** 处理封面图片 */
export const fetchCoverPlugin: MetadataNormalizePlugin = ({ cover }) => {
  let firstCoverBuffer: Buffer | undefined
  return async ({ metadata, index }) => {
    if (index === 0) {
      if (cover !== undefined) {
        firstCoverBuffer = cover
      }
      metadata.coverImage = firstCoverBuffer
    }
    if (index > 0) {
      if (metadata.coverImage === undefined && firstCoverBuffer !== undefined) {
        metadata.coverImage = firstCoverBuffer
      }
    }
  }
}
