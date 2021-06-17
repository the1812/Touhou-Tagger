"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localMp3 = exports.LocalMp3 = void 0;
const metadata_source_1 = require("../metadata-source");
const fs_1 = require("fs");
const id3 = require("../../node-id3");
const dirFilter = (path, predicate) => {
    return fs_1.readdirSync(path, { withFileTypes: true })
        .filter(predicate)
        .map(it => it.name);
};
class LocalMp3 extends metadata_source_1.MetadataSource {
    async resolveAlbumName(localSource) {
        const { resolve } = await Promise.resolve().then(() => require('path'));
        const { existsSync } = await Promise.resolve().then(() => require('fs'));
        const localSourcePath = resolve(localSource).replace(/\\/g, '/');
        if (!existsSync(localSourcePath)) {
            throw new Error('路径不存在');
        }
        return localSourcePath;
    }
    async getMultipleDiscFiles(path) {
        const { join } = await Promise.resolve().then(() => require('path'));
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
                const tags = new Proxy(id3.read(file), {
                    get(target, prop, ...args) {
                        if (prop in target) {
                            return Reflect.get(target, prop, ...args);
                        }
                        return '';
                    }
                });
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
