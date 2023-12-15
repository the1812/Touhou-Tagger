import { MetadataNormalizePlugin } from './normalize'

/** 自动推测 trackNumber 和 discNumber */
export const expandNumberPlugin: MetadataNormalizePlugin = () => {
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

/** 自动省略 trackNumber 和 discNumber */
export const simplifyNumberPlugin: MetadataNormalizePlugin = () => {
  const cachedTrackNumber = {
    number: 1,
  }
  const cachedDiscNumber = {
    index: 0,
    number: 1,
  }

  return ({ metadata, index }) => {
    if (metadata.discNumber !== undefined) {
      const discNumber = parseInt(metadata.discNumber)
      if (
        Number.isNaN(discNumber) ||
        (discNumber === cachedDiscNumber.number && index !== cachedDiscNumber.index)
      ) {
        delete metadata.discNumber
      } else if (discNumber !== cachedDiscNumber.number) {
        cachedDiscNumber.number = discNumber
        cachedDiscNumber.index = index
        cachedTrackNumber.number = 1
      }
    }
    if (metadata.trackNumber !== undefined) {
      const trackNumber = parseInt(metadata.trackNumber)
      if (Number.isNaN(trackNumber) || trackNumber === cachedTrackNumber.number) {
        delete metadata.trackNumber
      }
    }
    cachedTrackNumber.number += 1
  }
}
