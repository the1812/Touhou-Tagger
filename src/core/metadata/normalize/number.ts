import { MetadataNormalizePlugin } from './normalize'

/** 自动推测 trackNumber 和 discNumber */
export const expandNumberPlugin: MetadataNormalizePlugin = () => {
  const cachedNumber = {
    track: 1,
    disc: 1,
  }

  return ({ metadata }) => {
    const discNumberFromMetadata =
      metadata.discNumber !== undefined ? parseInt(metadata.discNumber) : NaN
    if (!Number.isNaN(discNumberFromMetadata) && discNumberFromMetadata !== cachedNumber.disc) {
      cachedNumber.disc = discNumberFromMetadata
      cachedNumber.track = 1
    }
    if (!metadata.discNumber) {
      metadata.discNumber = cachedNumber.disc.toString()
    }
    if (!metadata.trackNumber) {
      metadata.trackNumber = cachedNumber.track.toString()
    }
    cachedNumber.track += 1
  }
}

/** 自动省略 trackNumber 和 discNumber */
export const simplifyNumberPlugin: MetadataNormalizePlugin = () => {
  const cachedNumber = {
    track: 1,
    disc: 1,
  }

  return ({ metadata }) => {
    if (metadata.discNumber !== undefined) {
      const discNumber = parseInt(metadata.discNumber)
      if (Number.isNaN(discNumber) || discNumber === cachedNumber.disc) {
        delete metadata.discNumber
      } else if (discNumber !== cachedNumber.disc) {
        cachedNumber.disc = discNumber
        cachedNumber.track = 1
      }
    }
    if (metadata.trackNumber !== undefined) {
      const trackNumber = parseInt(metadata.trackNumber)
      if (Number.isNaN(trackNumber) || trackNumber === cachedNumber.track) {
        delete metadata.trackNumber
      }
    }
    cachedNumber.track += 1
  }
}
