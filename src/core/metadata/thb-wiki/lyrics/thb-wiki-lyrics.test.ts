import { thbWiki } from '../../..'
import { copyFileSync } from 'fs'
import { mp3Writer } from '../../../writer/mp3/mp3-writer'
import * as id3 from '../../../node-id3'
import { setDebug } from '../../../debug'

test('Write lyrics to mp3', async () => {
  const album = 'POP｜CULTURE 8'
  thbWiki.config.lyric = {
    type: 'original',
    output: 'metadata',
    time: false,
  }
  setDebug(true)
  const metadata = (await thbWiki.getMetadata(album))[1]
  console.log(metadata.lyricLanguage, metadata.lyric)
  const untagged = 'test-files/untagged/02 ARROW RAIN.mp3'
  const tagged = 'test-files/tagged/02 ARROW RAIN.mp3'
  copyFileSync(untagged, tagged)
  await mp3Writer.write(metadata, tagged)
  const tag = id3.read(tagged)
  console.log(tag.unsynchronisedLyrics)
  expect(tag.unsynchronisedLyrics.language).toBe('jpn')
  expect(tag.unsynchronisedLyrics.text).toMatch(/^居場所の跡と/)
}, 60 * 1000)