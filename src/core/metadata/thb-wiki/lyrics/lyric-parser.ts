import { LyricConfig } from '../../../core-config.js'
import { log } from '../../../debug.js'

const readCellText = (element: Element | undefined) => {
  if (!element) {
    return ''
  }
  const readNode = (node: Node): string => {
    if (node.nodeType === 1 && (node as Element).tagName.toLowerCase() === 'br') {
      return '\n'
    }
    if (node.nodeType === 3) {
      return (node as Text).data.replace(/\r/g, '').replace(/\n\s*/g, '')
    }
    return [...node.childNodes].map(readNode).join('')
  }
  return readNode(element)
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()
}

export abstract class LyricParser {
  protected rows: Element[]
  protected rowData: {
    originalData: Element
    translatedData: Element
    originalText: string
    translatedText: string
    hasTranslatedData: boolean
    time: string
  }[]
  protected get firstRow() {
    return this.rows[0]
  }
  protected get firstRowData() {
    return this.rowData[0]
  }
  constructor(
    protected table: Element,
    public config: LyricConfig,
  ) {
    this.rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')]
    log('rows length: ', this.rows.length)
    this.rowData = this.rows.map(row => {
      const time = row.querySelector('td.tt-time,td.tt-sep') as Element
      const [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')]
      const originalText = readCellText(originalData)
      const translatedText = readCellText(translatedData)
      let finalData: Element
      let finalText: string
      const hasTranslatedData = translatedText !== ''
      if (!hasTranslatedData) {
        finalData = originalData
        finalText = originalText
      } else {
        finalData = translatedData
        finalText = translatedText
      }
      const timeText = readCellText(time)
      return {
        time: timeText ? `[${timeText}] ` : '',
        originalData,
        translatedData: finalData,
        originalText,
        translatedText: finalText,
        hasTranslatedData,
      }
    })
  }
  readLyric() {
    return this.rows
      .map(row => {
        if (row.classList.contains('tt-lyrics-sep')) {
          return this.readEmptyRow(row)
        }
        return this.readLyricRow(row)
      })
      .join('\n')
  }
  protected abstract readLyricRow(row: Element): string
  protected getRowData(row: Element) {
    return this.rowData[this.rows.indexOf(row)]
  }
  protected readEmptyRow(row: Element): string {
    const { time } = this.getRowData(row)
    return this.config.time ? time.trimEnd() : ''
  }
  abstract findLanguage(): string | undefined
  abstract getLrcFileSuffix(): string
}
class OriginalLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    return this.firstRowData.originalData.getAttribute('lang') ?? undefined
  }
  readLyricRow(row: Element): string {
    const { originalText, time } = this.getRowData(row)
    if (this.config.time) {
      return time + originalText
    }
    return originalText
  }
  getLrcFileSuffix(): string {
    return '.'
  }
}
class TranslatedLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    const { originalData, translatedData, hasTranslatedData } = this.firstRowData
    if (hasTranslatedData) {
      return translatedData.getAttribute('lang') ?? undefined
    }
    return originalData.getAttribute('lang') ?? undefined
  }
  readLyricRow(row: Element): string {
    const { translatedText, time } = this.getRowData(row)
    if (this.config.time) {
      return time + translatedText
    }
    return translatedText
  }
  getLrcFileSuffix(): string {
    return `.${String(this.findLanguage())}`
  }
}
class MixedLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    const { originalData, hasTranslatedData } = this.firstRowData
    if (hasTranslatedData) {
      return undefined
    }
    return originalData.getAttribute('lang') ?? undefined
  }
  readLyricRow(row: Element): string {
    const { originalText, translatedText, hasTranslatedData, time } = this.getRowData(row)
    let lyric = originalText
    if (hasTranslatedData) {
      lyric += this.config.translationSeparator + translatedText
    }
    if (this.config.time) {
      lyric = lyric
        .split('\n')
        .map(it => time + it)
        .join('\n')
    }
    return lyric
  }
  getLrcFileSuffix(): string {
    return '.all'
  }
}
export const getLyricParser = (table: Element, config: LyricConfig) => {
  switch (config.type) {
    case 'translated':
      return new TranslatedLyricParser(table, config)
    case 'mixed':
      return new MixedLyricParser(table, config)
    case 'original': // fallthrough
    default:
      return new OriginalLyricParser(table, config)
  }
}
