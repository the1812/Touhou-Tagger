import { copyFile, mkdir, readdir, writeFile } from 'fs/promises'
import { join } from 'path'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { flacReader } from '../src/core/reader/flac/flac-reader.js'
import { mp3Reader } from '../src/core/reader/mp3/mp3-reader.js'
import { cleanTmp, createMetadata, fixturePath, metadataConfig, tmpPath } from './helpers.js'

beforeEach(async () => {
  await cleanTmp()
  vi.resetModules()
})

const writeAlbum = async (albumPath: string, audioFile: string, metadataTitle: string) => {
  await mkdir(albumPath, { recursive: true })
  await copyFile(fixturePath(audioFile), join(albumPath, audioFile))
  await copyFile(fixturePath('cover.jpg'), join(albumPath, 'cover.jpg'))
  const metadata = createMetadata()
  metadata.title = metadataTitle
  metadata.album = metadataTitle.replace(' Track', ' Album')
  await writeFile(join(albumPath, 'metadata.json'), JSON.stringify([metadata], null, 2))
}

describe('batch mode', () => {
  test('tags every album folder in batch mode', async () => {
    const batchRoot = tmpPath('batch')
    const flacAlbum = join(batchRoot, 'Flac Album')
    const mp3Album = join(batchRoot, 'Mp3 Album')
    await writeAlbum(flacAlbum, 'audio-blank.flac', 'Flac Track')
    await writeAlbum(mp3Album, 'audio-blank.mp3', 'Mp3 Track')

    const originalArgv = process.argv
    process.argv = [
      process.execPath,
      'thtag',
      '--batch',
      batchRoot,
      '--no-interactive',
      '--retry',
      '1',
    ]

    try {
      const { runBatchTagger } = await import('../src/cli/batch.js')
      await runBatchTagger(batchRoot, 1)
    } finally {
      process.argv = originalArgv
    }

    const [flacName] = (await readdir(flacAlbum)).filter(file => file.endsWith('.flac'))
    const [mp3Name] = (await readdir(mp3Album)).filter(file => file.endsWith('.mp3'))
    expect(flacName).toBe('01 Flac Track.flac')
    expect(mp3Name).toBe('01 Mp3 Track.mp3')

    flacReader.config = metadataConfig()
    mp3Reader.config = metadataConfig()
    const flacMetadata = await flacReader.read(join(flacAlbum, flacName))
    const mp3Metadata = await mp3Reader.read(join(mp3Album, mp3Name))
    expect(flacMetadata.title).toBe('Flac Track')
    expect(mp3Metadata.title).toBe('Mp3 Track')
    expect(flacMetadata.coverImage?.length).toBeGreaterThan(0)
    expect(mp3Metadata.coverImage?.length).toBeGreaterThan(0)
  })
})
