"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../../debug");
class LyricParser {
    constructor(table, config) {
        this.table = table;
        this.config = config;
        this.rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')];
        debug_1.log('rows length: ', this.rows.length);
        this.rowData = this.rows.map(row => {
            const time = row.querySelector('td.tt-time');
            let [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')];
            const hasTranslatedData = Boolean(translatedData && translatedData.textContent);
            if (!hasTranslatedData) {
                translatedData = originalData;
            }
            return {
                time: time ? `[${time.textContent}] ` : '',
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
        // TODO: lyric timeline
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
        const { originalData, time } = this.getRowData(row);
        if (this.config.time) {
            return time + originalData.textContent;
        }
        return originalData.textContent;
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
        const { translatedData, time } = this.getRowData(row);
        if (this.config.time) {
            return time + translatedData.textContent;
        }
        return translatedData.textContent;
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
        const { originalData, translatedData, hasTranslatedData, time } = this.getRowData(row);
        let lyric = originalData.textContent;
        if (hasTranslatedData) {
            lyric += '\n' + translatedData.textContent;
        }
        if (this.config.time) {
            lyric = time + lyric;
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
        case 'original': return new OriginalLyricParser(table, config);
        case 'translated': return new TranslatedLyricParser(table, config);
        case 'mixed': return new MixedLyricParser(table, config);
    }
};
