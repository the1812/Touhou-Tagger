"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../../debug");
class LyricParser {
    constructor(table) {
        this.table = table;
        this.rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')];
        debug_1.log('rows length: ', this.rows.length);
        this.rowData = this.rows.map(row => {
            let [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')];
            const hasTranslatedData = Boolean(translatedData && translatedData.textContent);
            if (!hasTranslatedData) {
                translatedData = originalData;
            }
            return {
                originalData,
                translatedData,
                hasTranslatedData,
            };
        });
    }
    get firstRow() { return this.rows[0]; }
    get firstRowData() { return this.rowData[0]; }
    readLyric() {
        return this.rows.map(row => {
            if (row.classList.contains('tt-lyrics-sep')) {
                return '';
            }
            else {
                return this.readLyricRow(row);
            }
        }).join('\n');
    }
    getRowData(row) {
        return this.rowData[this.rows.indexOf(row)];
    }
}
exports.LyricParser = LyricParser;
class OriginalLyricParser extends LyricParser {
    findLanguage() {
        return this.firstRowData.originalData.getAttribute('lang');
    }
    readLyricRow(row) {
        return this.getRowData(row).originalData.textContent;
    }
    getLrcFileSuffix() {
        return '';
    }
}
class TranslatedLyricParser extends LyricParser {
    findLanguage() {
        const { originalData, translatedData, hasTranslatedData } = this.firstRowData;
        if (hasTranslatedData) {
            return translatedData.getAttribute('lang');
        }
        return originalData.getAttribute('lang');
    }
    readLyricRow(row) {
        return this.getRowData(row).translatedData.textContent;
    }
    getLrcFileSuffix() {
        return '.' + this.findLanguage();
    }
}
class MixedLyricParser extends LyricParser {
    findLanguage() {
        const { originalData, hasTranslatedData } = this.firstRowData;
        if (hasTranslatedData) {
            return undefined;
        }
        else {
            return originalData.getAttribute('lang');
        }
    }
    readLyricRow(row) {
        const { originalData, translatedData, hasTranslatedData } = this.getRowData(row);
        let lyric = originalData.textContent;
        if (hasTranslatedData) {
            lyric += '\n' + translatedData.textContent;
        }
        return lyric;
    }
    getLrcFileSuffix() {
        return '.all';
    }
}
exports.getLyricParser = (table, config) => {
    switch (config.type) {
        default: // fallthrough
        case 'original': return new OriginalLyricParser(table);
        case 'translated': return new TranslatedLyricParser(table);
        case 'mixed': return new MixedLyricParser(table);
    }
};
