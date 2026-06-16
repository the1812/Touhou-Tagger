import { copyFile, readFile } from 'fs/promises'

import { beforeEach, describe, expect, test } from 'vitest'

import { flacReader } from '../src/core/reader/flac/flac-reader.js'
import { mp3Reader } from '../src/core/reader/mp3/mp3-reader.js'
import { flacWriter } from '../src/core/writer/flac/flac-writer.js'
import { mp3Writer } from '../src/core/writer/mp3/mp3-writer.js'
import {
  cleanTmp,
  createMetadata,
  expectMetadata,
  fixturePath,
  metadataConfig,
  tmpPath,
} from './helpers.js'

beforeEach(cleanTmp)

describe('metadata read/write', () => {
  test('writes and reads MP3 metadata', async () => {
    const writePath = tmpPath('metadata.mp3')
    const cover = await readFile(fixturePath('cover.jpg'))
    const metadata = createMetadata(cover)

    await copyFile(fixturePath('audio-blank.mp3'), writePath)
    mp3Writer.config = metadataConfig()
    await mp3Writer.write(metadata, writePath)

    mp3Reader.config = metadataConfig()
    const actual = await mp3Reader.read(writePath)
    expectMetadata(actual, metadata)
    expect(actual.lyricLanguage).toBe(metadata.lyricLanguage)
    expect(actual.coverImage?.equals(cover)).toBe(true)
  })

  test('writes and reads FLAC metadata', async () => {
    const writePath = tmpPath('metadata.flac')
    const cover = await readFile(fixturePath('cover.jpg'))
    const metadata = createMetadata(cover)

    await copyFile(fixturePath('audio-blank.flac'), writePath)
    flacWriter.config = metadataConfig()
    await flacWriter.write(metadata, writePath)

    flacReader.config = metadataConfig()
    const actual = await flacReader.read(writePath)
    expectMetadata(actual, metadata)
    expect(actual.coverImage?.equals(cover)).toBe(true)
  })
})
