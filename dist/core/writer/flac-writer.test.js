"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const flac_writer_1 = require("./flac-writer");
const inputFilename = 'test-files/untagged/flac/06 音轨 06.flac';
const outputFilename = 'test-files/tagged/flac/06 kiRa☆rhyTHm.flac';
const coverFilename = 'test-files/cover.jpg';
test('FLAC Metadata Write', async () => {
    fs_1.copyFileSync(inputFilename, outputFilename);
    const metadata = {
        title: 'kiRa☆rhyTHm',
        artists: ['缨缨Ei', '琉芸Miruku'],
        comments: '原曲: 年中夢中の好奇心',
        albumArtists: ['bunny rhyTHm'],
        albumOrder: 'BRTH-005',
        album: '覚めぬ夢 届かぬ恋',
        discNumber: '1',
        trackNumber: '6',
        year: '2018',
        coverImage: fs_1.readFileSync(coverFilename),
    };
    await flac_writer_1.flacWriter.write(metadata, outputFilename);
    expect(fs_1.readFileSync(outputFilename).length).not.toEqual(0);
});
