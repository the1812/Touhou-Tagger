import { copyFileSync, readFileSync } from 'fs'
import { mp3Writer } from './mp3-writer'
import * as id3 from 'node-id3'
import { Metadata } from '../metadata/metadata'
import { MetadataSeparator } from '../core-config'

const inputFilename = 'test-files/untagged/06 音轨 06.mp3'
const outputFilename = 'test-files/tagged/06 kiRa☆rhyTHm.mp3'
const coverFilename = 'test-files/cover.jpg'
test('MP3 Metadata Write', async () => {
  copyFileSync(inputFilename, outputFilename)
  const metadata: Metadata = {
    title: 'kiRa☆rhyTHm',
    artists: ['缨缨Ei', '琉芸Miruku'],
    comments: '原曲: 年中夢中の好奇心',
    albumArtists: ['bunny rhyTHm'],
    album: '覚めぬ夢 届かぬ恋',
    discNumber: '1',
    trackNumber: '6',
    year: '2018',
    coverImage: readFileSync(coverFilename),
  }
  await mp3Writer.write(metadata, outputFilename)
  const tag = id3.read(outputFilename)
  expect(tag.title).toEqual(metadata.title)
  expect(tag.artist).toEqual(metadata.artists.join(MetadataSeparator))
  expect(tag.performerInfo).toEqual(metadata.albumArtists!.join(MetadataSeparator))
  expect(tag.album).toEqual(metadata.album)
  expect(tag.comment.text).toEqual(metadata.comments)
  expect(tag.trackNumber).toEqual(metadata.trackNumber)
  expect(tag.year).toEqual(metadata.year)
  expect(tag.image!.imageBuffer).toEqual(metadata.coverImage)
})