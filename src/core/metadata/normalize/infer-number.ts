import { MetadataNormalizePlugin } from './normalize'

/** 自动推测 trackNumber 和 discNumber */
export const inferNumberPlugin: MetadataNormalizePlugin = () => {
  let cachedTrackNumber = 1
  let cachedDiscNumber = 1

  return ({ metadata }) => {
    if (metadata.discNumber && parseInt(metadata.discNumber) !== cachedDiscNumber) {
      cachedDiscNumber = parseInt(metadata.discNumber)
      cachedTrackNumber = 1
    }
    if (!metadata.discNumber) {
      metadata.discNumber = cachedDiscNumber.toString()
    }
    if (!metadata.trackNumber) {
      metadata.trackNumber = cachedTrackNumber.toString()
    }
    cachedTrackNumber += 1
  }
}
