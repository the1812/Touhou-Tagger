import { copyFileSync, readFileSync, createReadStream } from 'fs'
import { Metadata } from '../metadata/metadata'
import * as flac from 'flac-metadata'
import { flacWriter } from './flac-writer'
import { promisify } from 'util'
import { finished } from 'stream'

const inputFilename = 'test-files/untagged/flac/06 音轨 06.flac'
const outputFilename = 'test-files/tagged/flac/06 kiRa☆rhyTHm.flac'
const coverFilename = 'test-files/cover.jpg'
test('FLAC Metadata Write', async () => {
  copyFileSync(inputFilename, outputFilename)
  const metadata: Metadata = {
    title: 'kiRa☆rhyTHm',
    artists: ['缨缨Ei', '琉芸Miruku'],
    comments: '原曲: 年中夢中の好奇心',
    albumArtists: ['bunny rhyTHm'],
    albumOrder: 'BRTH-005',
    album: '覚めぬ夢 届かぬ恋',
    discNumber: '1',
    trackNumber: '6',
    year: '2018',
    coverImage: readFileSync(coverFilename),
  }
  await flacWriter.write(metadata, outputFilename)
  expect(readFileSync(outputFilename).length).not.toEqual(0)
})