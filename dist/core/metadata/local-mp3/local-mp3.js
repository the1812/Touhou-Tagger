"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localMp3 = exports.LocalMp3 = void 0;
const metadata_source_1 = require("../metadata-source");
const fs_1 = require("fs");
const exists_1 = require("../../exists");
const proxy_1 = require("../../proxy");
const id3 = __importStar(require("../../node-id3"));
const dirFilter = (path, predicate) => {
    return (0, fs_1.readdirSync)(path, { withFileTypes: true })
        .filter(predicate)
        .map(it => it.name);
};
class LocalMp3 extends metadata_source_1.MetadataSource {
    async resolveAlbumName(localSource) {
        return (0, exists_1.resolvePath)(localSource);
    }
    async getMultipleDiscFiles(path) {
        const { join } = await Promise.resolve().then(() => __importStar(require('path')));
        const subFolders = dirFilter(path, it => it.isDirectory() && /^Disc (\d+)/.test(it.name));
        const mp3Filter = (it) => it.isFile() && it.name.endsWith('.mp3');
        if (subFolders.length > 0) {
            return subFolders.map(folder => {
                return dirFilter(join(path, folder), mp3Filter).map(name => join(path, folder, name));
            });
        }
        return [dirFilter(path, mp3Filter).map(name => join(path, name))];
    }
    async getMetadata(fullPath, cover) {
        const discs = await this.getMultipleDiscFiles(fullPath);
        const metadatas = discs.map((discFiles, index) => {
            const discNumber = (index + 1).toString();
            return discFiles.map(file => {
                const tags = (0, proxy_1.defaultsToEmptyString)(id3.read(file));
                const separator = this.config.separator;
                const metadata = {
                    title: tags.title,
                    artists: tags.artist.split(separator),
                    discNumber,
                    trackNumber: tags.trackNumber,
                    composers: tags.composer ? tags.composer.split(separator) : undefined,
                    comments: tags.comment ? tags.comment.text : undefined,
                    lyricists: tags.textWriter ? tags.textWriter.split(separator) : undefined,
                    album: tags.album,
                    albumOrder: tags.albumOrder || '',
                    albumArtists: tags.performerInfo ? tags.performerInfo.split(separator) : undefined,
                    genres: tags.genre ? tags.genre.split(separator) : undefined,
                    year: tags.year || undefined,
                    coverImage: (tags.image && tags.image.imageBuffer) || cover || undefined,
                };
                if (this.config.lyric && tags.unsynchronisedLyrics) {
                    metadata.lyric = tags.unsynchronisedLyrics.text;
                    metadata.lyricLanguage = tags.unsynchronisedLyrics.language;
                }
                return metadata;
            });
        }).flat();
        return metadatas;
    }
}
exports.LocalMp3 = LocalMp3;
exports.localMp3 = new LocalMp3();
