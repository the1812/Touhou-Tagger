const isNodeAnElement = <TargetType extends Element>(
  node: Node,
  tagName: string,
): node is TargetType => {
  // Node.ELEMENT_NODE === 1
  return node.nodeType === 1 && (node as Element).tagName.toLowerCase() === tagName
}
const splitChildNodesByBr = (element: Element) => {
  const result: ChildNode[][] = []
  const allNodes = [...element.childNodes]
  let startIndex = 0
  allNodes.forEach((node, index) => {
    if (isNodeAnElement(node, 'br')) {
      const slice = allNodes.slice(startIndex, index)
      result.push(slice)
      startIndex = index + 1
    }
  })
  result.push(allNodes.slice(startIndex))
  return result
}
type TrackParseInfo = { name: string; result: string | string[] }

export const parseRelatedRowInfo = (trackInfoRow: Element): TrackParseInfo => {
  const replaceSinglePrefix = (data: string) => {
    const match = data.match(/^(.+?)：(.+)$/)
    if (match) {
      return match[2]
    }
    return data
  }
  const defaultInfoParser = (name: string): ((data: Element) => TrackParseInfo) => {
    return (data: Element) => {
      const children = [...data.children]
      const brIndex = children.findIndex(it => it.tagName.toLowerCase() === 'br')
      if (brIndex !== -1) {
        children.slice(brIndex).forEach(e => e.remove())
      }
      let { textContent } = data
      /*
        要是这个值就是一个_, THBWiki 会转成一个警告...
        例如疯帽子茶会'千年战争'中出现的编曲者就有一个_ (现已更名为'底线')
        https://thwiki.cc/%E5%8D%83%E5%B9%B4%E6%88%98%E4%BA%89%EF%BD%9Eiek_loin_staim_haf_il_dis_o-del_al
      */
      const warningMatch = textContent.match(
        /包含无效字符或不完整，并因此在查询或注释过程期间导致意外结果。\[\[(.+)\]\]/,
      )
      if (warningMatch) {
        textContent = warningMatch[1]
      }
      return {
        name,
        result: textContent
          .trim()
          .split('，')
          .map(it => replaceSinglePrefix(it)),
      }
    }
  }
  const isSequence = (data: Element) => {
    return [...data.childNodes].some(node => isNodeAnElement(node, 'br'))
  }

  const label = (trackInfoRow.querySelector('.label') as HTMLElement).textContent.trim()
  const rawData = trackInfoRow.querySelector('.text') as HTMLElement
  const actions: Partial<Record<string, (data: HTMLElement) => TrackParseInfo>> = {
    编曲: defaultInfoParser('arrangers'),
    再编曲: defaultInfoParser('remix'),
    作曲: defaultInfoParser('composers'),
    剧本: defaultInfoParser('scripts'),
    演唱: defaultInfoParser('vocals'),
    翻唱: defaultInfoParser('coverVocals'),
    和声: defaultInfoParser('harmonyVocals'),
    伴唱: defaultInfoParser('accompanyVocals'),
    合唱: defaultInfoParser('chorusVocals'),
    // 演奏: defaultInfoParser('instruments'),
    作词: defaultInfoParser('lyricists'),
    配音: data => {
      const name = 'voices'
      if (!isSequence(data)) {
        return defaultInfoParser(name)(data)
      }
      const slices = splitChildNodesByBr(data)
      const rows = slices.flatMap(it => {
        const anchors = it.filter((a): a is HTMLAnchorElement => isNodeAnElement(a, 'a'))
        const artists = anchors.map(a => {
          const isRealArtist =
            a.previousSibling &&
            a.previousSibling.textContent?.trim() === '（' &&
            a.nextSibling &&
            a.nextSibling.textContent?.trim() === '）'
          if (isRealArtist) {
            return a.textContent
          }
          return ''
        })
        if (artists.every(a => a === '')) {
          return anchors.map(a => a.textContent.trim())
        }
        return artists.filter(a => a !== '').map(a => a.trim())
      })
      return {
        name,
        result: rows,
      }
    },
    演奏: data => {
      const name = 'instruments'
      if (!isSequence(data)) {
        return defaultInfoParser(name)(data)
      }
      const slices = splitChildNodesByBr(data)
      const rows = slices
        .map(it => {
          const [instrumentOrPerformer, performer] = (it as [ChildNode, HTMLAnchorElement]).map(
            row => row.textContent ?? '',
          )
          const result = performer || instrumentOrPerformer
          const sequenceIndex = result.indexOf('：')
          if (sequenceIndex !== -1) {
            return result.substring(sequenceIndex + 1)
          }
          return result
        })
        .flatMap(row => row.split('，'))
        .map(it => it.trim())
      return {
        name,
        result: rows,
      }
    },
    原曲: data => {
      let result = `原曲: `
      const sources = [...data.querySelectorAll('.ogmusic,.source')] as Element[]
      sources.forEach((element, index) => {
        const comma = ', '
        if (element.classList.contains('ogmusic')) {
          result += element.textContent.trim()
          // 后面还有原曲时加逗号
          if (index < sources.length - 1 && sources[index + 1].classList.contains('ogmusic')) {
            result += comma
          }
        } else {
          // .source
          result += ` (${element.textContent.trim()})`
          // 不是最后一个source时加逗号
          if (index !== sources.length - 1) {
            result += comma
          }
        }
      })
      return {
        name: 'comments',
        result,
      }
    },
  }
  const action = actions[label]
  if (!action) {
    return { name: 'other', result: '' }
  }
  return action(rawData)
}
