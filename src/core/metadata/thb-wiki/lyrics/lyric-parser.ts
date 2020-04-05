import { LyricConfig } from '../../../core-config'
import { log } from '../../../debug'

export abstract class LyricParser {
  protected rows: Element[]
  protected rowData: { originalData: Element, translatedData: Element, hasTranslatedData: boolean, time: string }[]
  protected get firstRow() { return this.rows[0] }
  protected get firstRowData() { return this.rowData[0] }
  constructor(protected table: Element, public config: LyricConfig) {
    this.rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')]
    log('rows length: ', this.rows.length)
    this.rowData = this.rows.map(row => {
      const time = row.querySelector('td.tt-time,td.tt-sep') as Element
      let [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')]
      const hasTranslatedData = Boolean(translatedData && translatedData.textContent)
      if (!hasTranslatedData) {
        translatedData = originalData
      }
      const hasTime = Boolean(time && time.textContent!!.trim() !== '')
      return {
        time: hasTime ? `[${time.textContent!!.trim()}] ` : '',
        originalData,
        translatedData,
        hasTranslatedData,
      }
    })
  }
  readLyric() {
    return this.rows.map(row => {
      if (row.classList.contains('tt-lyrics-sep')) {
        return this.readEmptyRow(row)
      } else {
        return this.readLyricRow(row)
      }
    }).join('\n')
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
    return this.firstRowData.originalData.getAttribute('lang')!!
  }
  readLyricRow(row: Element): string {
    const { originalData, time } = this.getRowData(row)
    if (this.config.time) {
      return time + originalData.textContent
    }
    return originalData.textContent!!
  }
  getLrcFileSuffix(): string {
    return ''
  }
}
class TranslatedLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    const { originalData, translatedData, hasTranslatedData } = this.firstRowData
    if (hasTranslatedData) {
      return translatedData.getAttribute('lang')!!
    }
    return originalData.getAttribute('lang')!!
  }
  readLyricRow(row: Element): string {
    const { translatedData, time } = this.getRowData(row)
    if (this.config.time) {
      return time + translatedData.textContent
    }
    return translatedData.textContent!!
  }
  getLrcFileSuffix(): string {
    return '.' + this.findLanguage()
  }
}
class MixedLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    const { originalData, hasTranslatedData } = this.firstRowData
    if (hasTranslatedData) {
      return undefined
    } else {
      return originalData.getAttribute('lang')!!
    }
  }
  readLyricRow(row: Element): string {
    const { originalData, translatedData, hasTranslatedData, time } = this.getRowData(row)
    let lyric = originalData.textContent!!
    if (hasTranslatedData) {
      lyric += this.config.translationSeparator + translatedData.textContent
    }
    if (this.config.time) {
      lyric = lyric.split('\n').map(it => time + it).join('\n')
    }
    return lyric
  }
  getLrcFileSuffix(): string {
    return '.all'
  }
}
export const getLyricParser = (table: Element, config: LyricConfig) => {
  switch (config.type) {
    default: // fallthrough
    case 'original': return new OriginalLyricParser(table, config)
    case 'translated': return new TranslatedLyricParser(table, config)
    case 'mixed': return new MixedLyricParser(table, config)
  }
}