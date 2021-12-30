"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadLyrics = void 0;
const axios_1 = require("axios");
const jsdom_1 = require("jsdom");
const debug_1 = require("../../../debug");
const lyric_parser_1 = require("./lyric-parser");
let lyricParser;
const downloadMetadataLyrics = async () => {
    const lyric = lyricParser.readLyric();
    const lyricLanguage = lyricParser.findLanguage();
    (0, debug_1.log)(lyricLanguage);
    (0, debug_1.log)(lyric);
    return {
        lyric,
        lyricLanguage,
    };
};
const downloadLrcLyrics = async (title, index, config) => {
    const language = lyricParser.findLanguage();
    const indexString = index === 0 ? '' : `.${index + 1}`;
    const url = `https://touhou.cd/lyrics/${encodeURIComponent(title)}${indexString}${language}.lrc`;
    (0, debug_1.log)(url);
    let response;
    try {
        response = await axios_1.default.get(url, { responseType: 'text', timeout: config.timeout * 1000 });
        return {
            lyric: response.data,
            lyricLanguage: undefined
        };
    }
    catch (error) {
        console.error(`下载歌词失败: ${url}`);
        return {
            lyric: '',
            lyricLanguage: undefined
        };
    }
};
const lyricDocumentCache = new Map();
const downloadLyrics = async (url, title, config) => {
    (0, debug_1.log)(`\n下载歌词中: ${title}`);
    let document = lyricDocumentCache.get(url);
    if (!document) {
        const response = await axios_1.default.get(url, { timeout: config.timeout * 1000 });
        const dom = new jsdom_1.JSDOM(response.data);
        document = dom.window.document;
        lyricDocumentCache.set(url, document);
    }
    let table;
    const tables = [...document.querySelectorAll('.wikitable[class*="tt-type-lyric"]')];
    (0, debug_1.log)('tables length: ', tables.length);
    if (tables.length > 1) { // 歌词可能有多个版本
        const titles = tables.map(table => {
            const t = table.parentElement.title;
            return t.substring(0, t.length - 1); // 移除最后一个'版'字
        });
        (0, debug_1.log)(titles);
        // 如果传入的标题匹配(包含)其中某个标题, 就使用对应版本, 否则使用默认版本
        // 反转了一下让后面的优先匹配
        const matchIndex = [...titles].reverse().findIndex(t => title.includes(t));
        (0, debug_1.log)(matchIndex, tables.length - matchIndex - 1);
        if (matchIndex !== -1) {
            table = tables[tables.length - matchIndex - 1];
        }
        else {
            [table] = tables;
        }
        (0, debug_1.log)(table);
    }
    else {
        [table] = tables;
    }
    lyricParser = (0, lyric_parser_1.getLyricParser)(table, config.lyric);
    switch (config.lyric.output) {
        case 'metadata':
        default:
            return await downloadMetadataLyrics();
        case 'lrc':
            const originalTitle = document.querySelector('.firstHeading').textContent.replace('歌词:', '');
            return await downloadLrcLyrics(originalTitle, tables.indexOf(table), config);
    }
};
exports.downloadLyrics = downloadLyrics;
