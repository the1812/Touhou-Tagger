import { LyricConfig } from '../../../core-config'
import { log } from '../../../debug'

export abstract class LyricParser {
  protected rows: Element[]
  protected rowData: {
    originalData: Element
    translatedData: Element
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
      let finalData: Element
      const hasTranslatedData = Boolean(translatedData && translatedData.textContent)
      if (!hasTranslatedData) {
        finalData = originalData
      } else {
        finalData = translatedData
      }
      const hasTime = Boolean(time && time.textContent.trim() !== '')
      return {
        time: hasTime ? `[${time.textContent.trim()}] ` : '',
        originalData,
        translatedData: finalData,
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
    return time
  }
  abstract findLanguage(): string | undefined
  abstract getLrcFileSuffix(): string
}
class OriginalLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    return this.firstRowData.originalData.getAttribute('lang')
  }
  readLyricRow(row: Element): string {
    const { originalData, time } = this.getRowData(row)
    if (this.config.time) {
      return time + originalData.textContent
    }
    return originalData.textContent
  }
  getLrcFileSuffix(): string {
    return ''
  }
}
class TranslatedLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    const { originalData, translatedData, hasTranslatedData } = this.firstRowData
    if (hasTranslatedData) {
      return translatedData.getAttribute('lang')
    }
    return originalData.getAttribute('lang')
  }
  readLyricRow(row: Element): string {
    const { translatedData, time } = this.getRowData(row)
    if (this.config.time) {
      return time + translatedData.textContent
    }
    return translatedData.textContent
  }
  getLrcFileSuffix(): string {
    return `.${this.findLanguage()}`
  }
}
class MixedLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    const { originalData, hasTranslatedData } = this.firstRowData
    if (hasTranslatedData) {
      return undefined
    }
    return originalData.getAttribute('lang')
  }
  readLyricRow(row: Element): string {
    const { originalData, translatedData, hasTranslatedData, time } = this.getRowData(row)
    let lyric = originalData.textContent
    if (hasTranslatedData) {
      lyric += this.config.translationSeparator + translatedData.textContent
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
