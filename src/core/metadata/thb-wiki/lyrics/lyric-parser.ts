import { LyricConfig } from '../../../core-config'
import { log } from '../../../debug'

export abstract class LyricParser {
  protected rows: Element[]
  protected rowData: { originalData: Element, translatedData: Element, hasTranslatedData: boolean }[]
  protected get firstRow() { return this.rows[0] }
  protected get firstRowData() { return this.rowData[0] }
  constructor(protected table: Element) {
    this.rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')]
    log('rows length: ', this.rows.length)
    this.rowData = this.rows.map(row => {
      let [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')]
      const hasTranslatedData = Boolean(translatedData && translatedData.textContent)
      if (!hasTranslatedData) {
        translatedData = originalData
      }
      return {
        originalData,
        translatedData,
        hasTranslatedData,
      }
    })
  }
  readLyric() {
    return this.rows.map(row => {
      if (row.classList.contains('tt-lyrics-sep')) {
        return ''
      } else {
        return this.readLyricRow(row)
      }
    }).join('\n')
  }
  protected abstract readLyricRow(row: Element): string
  protected getRowData(row: Element) {
    return this.rowData[this.rows.indexOf(row)]
  }
  abstract findLanguage(): string | undefined
  abstract getLrcFileSuffix(): string
}
class OriginalLyricParser extends LyricParser {
  findLanguage(): string | undefined {
    return this.firstRowData.originalData.getAttribute('lang')!!
  }
  readLyricRow(row: Element): string {
    return this.getRowData(row).originalData.textContent!!
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
    return this.getRowData(row).translatedData.textContent!!
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
    const { originalData, translatedData, hasTranslatedData } = this.getRowData(row)
    let lyric = originalData.textContent!!
    if (hasTranslatedData) {
      lyric += '\n' + translatedData.textContent
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
    case 'original': return new OriginalLyricParser(table)
    case 'translated': return new TranslatedLyricParser(table)
    case 'mixed': return new MixedLyricParser(table)
  }
}