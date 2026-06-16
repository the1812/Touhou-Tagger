import { mkdir, rm } from 'fs/promises'
import { join } from 'path'

import { expect } from 'vitest'

import type { Metadata, MetadataConfig } from '../src/core/index.js'

export const fixturePath = (...paths: string[]) => join(process.cwd(), 'test', 'fixtures', ...paths)
export const tmpPath = (...paths: string[]) => join(process.cwd(), 'test', '.tmp', ...paths)

export const cleanTmp = async () => {
  await rm(tmpPath(), { recursive: true, force: true })
  await mkdir(tmpPath(), { recursive: true })
}

export const metadataConfig = (overrides: Partial<MetadataConfig> = {}): MetadataConfig => ({
  commentLanguage: 'zho',
  coverCompressSize: 0,
  coverCompressResolution: 0,
  separator: ' / ',
  timeout: 5,
  retry: 1,
  ...overrides,
})

export const createMetadata = (coverImage?: Buffer): Metadata => ({
  title: 'Test Title',
  artists: ['Artist One', 'Artist Two'],
  album: 'Test Album',
  albumOrder: 'TEST-001',
  albumArtists: ['Album Artist'],
  genres: ['Rock', 'Game'],
  year: '2026',
  discNumber: '1',
  trackNumber: '1',
  composers: ['Composer One'],
  comments: 'Test Comment',
  lyricLanguage: 'ja',
  lyric: 'Test lyric line',
  lyricists: ['Lyricist One'],
  bpm: '128',
  key: 'Am',
  coverImage,
})

export const expectMetadata = (actual: Metadata, expected: Metadata) => {
  expect(actual.title).toBe(expected.title)
  expect(actual.artists).toEqual(expected.artists)
  expect(actual.album).toBe(expected.album)
  expect(actual.albumOrder).toBe(expected.albumOrder)
  expect(actual.albumArtists).toEqual(expected.albumArtists)
  expect(actual.genres).toEqual(expected.genres)
  expect(actual.year).toBe(expected.year)
  expect(actual.discNumber).toBe(expected.discNumber)
  expect(actual.trackNumber).toBe(expected.trackNumber)
  expect(actual.composers).toEqual(expected.composers)
  expect(actual.comments).toBe(expected.comments)
  expect(actual.lyric).toBe(expected.lyric)
  expect(actual.lyricists).toEqual(expected.lyricists)
  expect(actual.bpm).toBe(expected.bpm)
  expect(actual.key).toBe(expected.key)
  expect(actual.coverImage?.length).toBe(expected.coverImage?.length)
}
