import axios from 'axios'
import { afterEach, describe, expect, test, vi } from 'vite-plus/test'

import { ThbWiki } from '../src/core/metadata/thb-wiki/thb-wiki.js'
import { metadataConfig } from './helpers.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('THBWiki OpenSearch contracts', () => {
  test.each([
    {
      name: 'exact match',
      query: 'Perfect Album',
      names: ['Perfect Album', '歌词:Perfect Album', 'Perfect Album/Other'],
      expected: ['Perfect Album', 'Perfect Album/Other'],
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
    const request = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      data: [contract.query, contract.names, [], []],
      status: 200,
    })
    const [coveredName] = contract.expected
    request
      .mockResolvedValueOnce({
        data: {
          query: {
            results: coveredName
              ? {
                  [coveredName]: {
                    printouts: {
                      制作方: [{ fulltext: 'Circle A' }, { fulltext: 'Circle B' }],
                      封面图片: [{ fulltext: 'File:Album_cover.jpg' }],
                    },
                  },
                }
              : {},
          },
        },
        status: 200,
      })
      .mockResolvedValueOnce({
        data: {
          query: {
            normalized: [{ from: 'File:Album_cover.jpg', to: '文件:Album cover.jpg' }],
            pages: [
              {
                title: '文件:Album cover.jpg',
                imageinfo: [
                  {
                    url: 'https://example.test/original.jpg',
                    thumburl: 'https://example.test/500px-cover.jpg',
                  },
                ],
              },
            ],
          },
        },
        status: 200,
      })
    const source = new ThbWiki('fixture.invalid')
    source.config = metadataConfig()

    await expect(source.search(contract.query)).resolves.toEqual(
      contract.expected.map((name, index) => ({
        id: name,
        name,
        artists: index === 0 ? ['Circle A', 'Circle B'] : [],
        thumbnailUrl: index === 0 ? 'https://example.test/500px-cover.jpg' : undefined,
      })),
    )
    expect(request).toHaveBeenCalledTimes(coveredName ? 3 : 1)
    if (coveredName) {
      const [url, options] = request.mock.calls[2]
      expect(url).toBe('https://fixture.invalid/api.php')
      expect(options?.params).toMatchObject({
        prop: 'imageinfo',
        iiurlwidth: '500',
        iiurlheight: '500',
      })
    }
  })
})
