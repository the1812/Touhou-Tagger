"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLyricParser = exports.LyricParser = void 0;
const debug_1 = require("../../../debug");
class LyricParser {
    table;
    config;
    rows;
    rowData;
    get firstRow() { return this.rows[0]; }
    get firstRowData() { return this.rowData[0]; }
    constructor(table, config) {
        this.table = table;
        this.config = config;
        this.rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')];
        (0, debug_1.log)('rows length: ', this.rows.length);
        this.rowData = this.rows.map(row => {
            const time = row.querySelector('td.tt-time,td.tt-sep');
            let [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')];
            const hasTranslatedData = Boolean(translatedData && translatedData.textContent);
            if (!hasTranslatedData) {
                translatedData = originalData;
            }
            const hasTime = Boolean(time && time.textContent.trim() !== '');
            return {
                time: hasTime ? `[${time.textContent.trim()}] ` : '',
                originalData,
                translatedData,
                hasTranslatedData,
            };
        });
    }
    readLyric() {
        return this.rows.map(row => {
            if (row.classList.contains('tt-lyrics-sep')) {
                return this.readEmptyRow(row);
            }
            else {
                return this.readLyricRow(row);
            }
        }).join('\n');
    }
    getRowData(row) {
        return this.rowData[this.rows.indexOf(row)];
    }
    readEmptyRow(row) {
        const { time } = this.getRowData(row);
        return time;
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
            lyric += this.config.translationSeparator + translatedData.textContent;
        }
        if (this.config.time) {
            lyric = lyric.split('\n').map(it => time + it).join('\n');
        }
        return lyric;
    }
    getLrcFileSuffix() {
        return '.all';
    }
}
const getLyricParser = (table, config) => {
    switch (config.type) {
        default: // fallthrough
        case 'original': return new OriginalLyricParser(table, config);
        case 'translated': return new TranslatedLyricParser(table, config);
        case 'mixed': return new MixedLyricParser(table, config);
    }
};
exports.getLyricParser = getLyricParser;
