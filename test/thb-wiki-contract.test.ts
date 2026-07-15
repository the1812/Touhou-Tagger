import { readFile } from 'fs/promises'

import axios from 'axios'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { LyricConfig, Metadata } from '../src/core/index.js'
import { downloadLyrics } from '../src/core/metadata/thb-wiki/lyrics/thb-wiki-lyrics.js'
import { ThbWiki } from '../src/core/metadata/thb-wiki/thb-wiki.js'
import { fixturePath, metadataConfig } from './helpers.js'

type AlbumContract = {
  cover: boolean
  album: Pick<Metadata, 'album' | 'albumOrder' | 'albumArtists' | 'genres' | 'year'>
  tracks: Array<
    Pick<Metadata, 'title' | 'artists' | 'discNumber' | 'trackNumber'> &
      Partial<Pick<Metadata, 'composers' | 'comments' | 'lyricists'>>
  >
}

type LyricContract = {
  name: string
  title: string
  type: LyricConfig['type']
  time: boolean
  translationSeparator: string
  language: string | null
  expected: string
}

const albumCases = [
  'single-disc',
  'multiple-disc',
  'has-composer',
  'no-cover',
  'multiline-artists',
  'multiple-instruments',
  'remix-compilation',
]

const lyricCases = ['single-lang', 'multiple-lang']
const fixtureCover = Buffer.from('fixture cover')

const readExpectedText = async (...paths: string[]) =>
  (await readFile(fixturePath(...paths), 'utf8')).replace(/\r?\n$/, '')

const withoutUndefined = (metadata: Metadata) =>
  Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('THBWiki album contracts', () => {
  for (const name of albumCases) {
    test(name, async () => {
      const basePath = ['thb-wiki', 'albums', name]
      const [html, expectedData] = await Promise.all([
        readFile(fixturePath(...basePath, 'page.html'), 'utf8'),
        readFile(fixturePath(...basePath, 'expected.json'), 'utf8'),
      ])
      const contract = JSON.parse(expectedData) as AlbumContract
      const albumUrl = `https://fixture.invalid/${encodeURIComponent(name)}`
      const get = vi.spyOn(axios, 'get').mockImplementation(url => {
        const data = url === albumUrl ? html : fixtureCover
        return Promise.resolve({ data, status: 200 }) as ReturnType<typeof axios.get>
      })
      const source = new ThbWiki('fixture.invalid')
      source.config = metadataConfig()

      const actual = await source.getMetadata(name)
      const hasCover = actual.every(metadata => Boolean(metadata.coverImage))
      const metadata = actual.map(({ coverImage, ...track }) => withoutUndefined(track as Metadata))
      const expected = contract.tracks.map(track => ({ ...contract.album, ...track }))

      expect(hasCover).toBe(contract.cover)
      expect(metadata).toEqual(expected)
      expect(get).toHaveBeenCalledTimes(contract.cover ? 2 : 1)
    })
  }
})

describe('THBWiki OpenSearch contracts', () => {
  test.each([
    {
      name: 'exact match',
      query: 'Perfect Album',
      names: ['Perfect Album', '歌词:Perfect Album', 'Perfect Album/Other'],
      expected: 'Perfect Album',
    },
    {
      name: 'fuzzy matches',
      query: 'Fuzzy',
      names: ['歌词:Fuzzy Song', 'Fuzzy Album', 'Fuzzy Collection'],
      expected: ['Fuzzy Album', 'Fuzzy Collection'],
    },
    {
      name: 'lyric pages only',
      query: 'Lyrics',
      names: ['歌词:Lyrics', '歌词:Lyrics/Version'],
      expected: [],
    },
  ])('handles $name', async contract => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: [contract.query, contract.names, [], []],
      status: 200,
    })
    const source = new ThbWiki('fixture.invalid')
    source.config = metadataConfig()

    await expect(source.resolveAlbumName(contract.query)).resolves.toEqual(contract.expected)
  })
})

describe('THBWiki lyric contracts', () => {
  for (const name of lyricCases) {
    test(name, async () => {
      const basePath = ['thb-wiki', 'lyrics', name]
      const [html, casesData] = await Promise.all([
        readFile(fixturePath(...basePath, 'page.html'), 'utf8'),
        readFile(fixturePath(...basePath, 'cases.json'), 'utf8'),
      ])
      const cases = JSON.parse(casesData) as LyricContract[]
      vi.spyOn(axios, 'get').mockImplementation(
        () => Promise.resolve({ data: html, status: 200 }) as ReturnType<typeof axios.get>,
      )

      for (const contract of cases) {
        const expected = await readExpectedText(...basePath, contract.expected)
        const lyric: LyricConfig = {
          type: contract.type,
          output: 'metadata',
          time: contract.time,
          translationSeparator: contract.translationSeparator,
          maxCacheSize: 10,
        }
        const result = await downloadLyrics(`https://fixture.invalid/${name}`, contract.title, {
          ...metadataConfig(),
          lyric,
        } as Required<ReturnType<typeof metadataConfig>>)

        expect(result.lyric, contract.name).toBe(expected)
        expect(result.lyricLanguage ?? null, contract.name).toBe(contract.language)
      }
    })
  }

  test.each([
    {
      name: 'single-lang',
      trackTitle: 'irrelevant track title',
      pageTitle: '歌于绯想 剑问真情',
      version: '',
      language: 'zh',
    },
    {
      name: 'multiple-lang',
      trackTitle: 'Bad Apple!! Graph Tech Remix',
      pageTitle: 'Bad Apple!!（Alstroemeria Records）',
      version: '.3',
      language: 'ja',
    },
  ])('normalizes the $name heading for LRC downloads', async contract => {
    const basePath = ['thb-wiki', 'lyrics', contract.name]
    const [html, expected] = await Promise.all([
      readFile(fixturePath(...basePath, 'page.html'), 'utf8'),
      readExpectedText(...basePath, 'expected', 'lrc.txt'),
    ])
    const pageUrl = `https://fixture.invalid/${contract.name}-lrc`
    const expectedUrl = `https://cd.thwiki.cc/lyrics/${encodeURIComponent(contract.pageTitle)}${contract.version}..lrc`
    const get = vi.spyOn(axios, 'get').mockImplementation(url => {
      const data = url === pageUrl ? html : expected
      return Promise.resolve({ data, status: 200 }) as ReturnType<typeof axios.get>
    })
    const lyric: LyricConfig = {
      type: 'original',
      output: 'lrc',
      time: true,
      translationSeparator: ' / ',
      maxCacheSize: 10,
    }

    const result = await downloadLyrics(pageUrl, contract.trackTitle, {
      ...metadataConfig(),
      lyric,
    } as Required<ReturnType<typeof metadataConfig>>)

    expect(result).toEqual({ lyric: expected, lyricLanguage: contract.language })
    expect(get).toHaveBeenNthCalledWith(2, expectedUrl, {
      responseType: 'text',
      timeout: 5000,
    })
  })
})
