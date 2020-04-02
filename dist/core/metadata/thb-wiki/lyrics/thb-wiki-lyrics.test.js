"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../../..");
const fs_1 = require("fs");
const mp3_writer_1 = require("../../../writer/mp3/mp3-writer");
const id3 = require("../../../node-id3");
const debug_1 = require("../../../debug");
test('Write lyrics to mp3', async () => {
    const album = 'POP｜CULTURE 8';
    __1.thbWiki.config.lyric = {
        type: 'original',
        output: 'metadata',
        time: false,
    };
    debug_1.setDebug(true);
    const metadata = (await __1.thbWiki.getMetadata(album))[1];
    console.log(metadata.lyricLanguage, metadata.lyric);
    const untagged = 'test-files/untagged/02 ARROW RAIN.mp3';
    const tagged = 'test-files/tagged/02 ARROW RAIN.mp3';
    fs_1.copyFileSync(untagged, tagged);
    await mp3_writer_1.mp3Writer.write(metadata, tagged);
    const tag = id3.read(tagged);
    console.log(tag.unsynchronisedLyrics);
    expect(tag.unsynchronisedLyrics.language).toBe('jpn');
    expect(tag.unsynchronisedLyrics.text).toMatch(/^居場所の跡と/);
}, 60 * 1000);
