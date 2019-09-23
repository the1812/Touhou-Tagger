"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const mp3_writer_1 = require("./mp3-writer");
const id3 = require("node-id3");
const inputFilename = 'test-files/untagged/06 音轨 06.mp3';
const outputFilename = 'test-files/tagged/06 kiRa☆rhyTHm.mp3';
const coverFilename = 'test-files/cover.jpg';
test('MP3 Metadata Write', async () => {
    fs_1.copyFileSync(inputFilename, outputFilename);
    const metadata = {
        title: 'kiRa☆rhyTHm',
        artists: ['缨缨Ei', '琉芸Miruku'],
        comments: '原曲: 年中夢中の好奇心',
        albumArtists: ['bunny rhyTHm'],
        album: '覚めぬ夢 届かぬ恋',
        discNumber: '1',
        trackNumber: '6',
        year: '2018',
        coverImage: fs_1.readFileSync(coverFilename),
    };
    await mp3_writer_1.mp3Writer.write(metadata, outputFilename);
    const tag = id3.read(outputFilename);
    expect(tag.title).toEqual(metadata.title);
    expect(tag.artist).toEqual(metadata.artists.join(', '));
    expect(tag.performerInfo).toEqual(metadata.albumArtists.join(', '));
    expect(tag.album).toEqual(metadata.album);
    expect(tag.comment.text).toEqual(metadata.comments);
    expect(tag.trackNumber).toEqual(metadata.trackNumber);
    expect(tag.year).toEqual(metadata.year);
    expect(tag.image.imageBuffer).toEqual(metadata.coverImage);
});
