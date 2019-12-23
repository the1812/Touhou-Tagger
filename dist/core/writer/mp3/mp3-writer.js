"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metadata_writer_1 = require("../metadata-writer");
const id3 = require("../../node-id3");
const core_config_1 = require("../../core-config");
const languageCodeConvert = (code) => {
    const mapping = {
        ja: 'jpn',
        de: 'deu',
        zh: 'zho'
    };
    return code ? (mapping[code] || 'jpn') : 'jpn';
};
const getNodeId3Tag = (metadata) => {
    const tag = {
        title: metadata.title,
        artist: metadata.artists.join(core_config_1.MetadataSeparator),
        album: metadata.album,
        partOfSet: metadata.discNumber,
        trackNumber: metadata.trackNumber,
        composer: metadata.composers ? metadata.composers.join(core_config_1.MetadataSeparator) : '',
        genre: metadata.genres ? metadata.genres.join(core_config_1.MetadataSeparator) : '',
        year: metadata.year || '',
        textWriter: metadata.lyricists ? metadata.lyricists.join(core_config_1.MetadataSeparator) : '',
        performerInfo: metadata.albumArtists ? metadata.albumArtists.join(core_config_1.MetadataSeparator) : '',
        comment: {
            text: metadata.comments || '',
        },
        unsynchronisedLyrics: {
            language: languageCodeConvert(metadata.lyricLanguage),
            text: metadata.lyric || '',
        },
        TSOA: metadata.albumOrder,
    };
    if (metadata.coverImage) {
        tag.image = {
            type: {
                id: 3,
                name: 'front cover'
            },
            description: metadata.album,
            imageBuffer: metadata.coverImage,
        };
    }
    return tag;
};
class Mp3Writer extends metadata_writer_1.MetadataWriter {
    async write(metadata, filePath) {
        const tag = getNodeId3Tag(metadata);
        if (this.config.lyric && this.config.lyric.output === 'lrc') {
            tag.unsynchronisedLyrics.text = '';
            tag.unsynchronisedLyrics.language = undefined;
        }
        const result = id3.write(tag, filePath);
        if (result === false) {
            throw new Error(`Write operation failed. filePath = ${filePath}`);
        }
    }
}
exports.Mp3Writer = Mp3Writer;
exports.mp3Writer = new Mp3Writer();
