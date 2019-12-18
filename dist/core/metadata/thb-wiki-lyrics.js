"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const jsdom_1 = require("jsdom");
const debug_1 = require("../debug");
const findLanguage = (table, config) => {
    const [row] = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')];
    const [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')];
    switch (config.type) {
        case 'original': {
            return originalData.getAttribute('lang');
        }
        case 'translated': {
            return translatedData.getAttribute('lang');
        }
        case 'mixed':
        default:
            return undefined;
    }
};
const downloadMetadataLyrics = async (table, config) => {
    const rows = [...table.querySelectorAll('tbody > tr:not(.tt-lyrics-header)')];
    let lyric = '';
    rows.forEach(row => {
        if (row.classList.contains('tt-lyrics-sep')) {
            lyric += '\n';
        }
        else {
            const [originalData, translatedData] = [...row.querySelectorAll('td:not(.tt-time)')];
            switch (config.type) {
                case 'original': {
                    lyric += originalData.textContent + '\n';
                    break;
                }
                case 'translated': {
                    lyric += translatedData.textContent + '\n';
                    break;
                }
                case 'mixed': {
                    lyric += originalData.textContent + '\n' + translatedData.textContent + '\n';
                    break;
                }
            }
        }
    });
    const lyricLanguage = findLanguage(table, config);
    debug_1.log(lyric.length);
    debug_1.log(lyricLanguage);
    return {
        lyric,
        lyricLanguage,
    };
};
const downloadLrcLyrics = async (table, title, index, config) => {
    const language = (() => {
        switch (config.type) {
            default:
            case 'original':
                return '';
            case 'translated':
                return '.' + findLanguage(table, config);
            case 'mixed':
                return '.all';
        }
    })();
    const indexString = index === 0 ? '' : `.${index + 1}`;
    const url = `https://touhou.cd/lyrics/${encodeURIComponent(title)}${indexString}${language}.lrc`;
    debug_1.log(url);
    const response = await axios_1.default.get(url, { responseType: 'text' });
    return {
        lyric: response.data,
        lyricLanguage: undefined
    };
};
exports.downloadLyrics = async (url, title, config) => {
    console.log(`下载歌词中: ${title}`);
    const response = await axios_1.default.get(url);
    const dom = new jsdom_1.JSDOM(response.data);
    const document = dom.window.document;
    let table;
    const tables = [...document.querySelectorAll('.wikitable.tt-type-lyrics')];
    if (tables.length > 1) { // 歌词可能有多个版本
        const titles = tables.map(table => {
            const t = table.parentElement.title;
            return t.substring(0, t.length - 1); // 移除最后一个'版'字
        });
        // 如果传入的标题匹配(包含)其中某个标题, 就使用对应版本, 否则使用默认版本
        // 反转了一下让后面的优先匹配
        const matchIndex = [...titles].reverse().findIndex(t => title.includes(t));
        if (matchIndex) {
            table = tables[tables.length - matchIndex - 1];
        }
        else {
            [table] = tables;
        }
    }
    else {
        [table] = tables;
    }
    switch (config.output) {
        case 'metadata':
        default:
            return await downloadMetadataLyrics(table, config);
        case 'lrc':
            const originalTitle = document.querySelector('.firstHeading').textContent.replace('歌词:', '');
            return await downloadLrcLyrics(table, originalTitle, tables.indexOf(table), config);
    }
};
