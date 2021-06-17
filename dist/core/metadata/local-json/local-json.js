"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localJson = exports.LocalJson = void 0;
const metadata_source_1 = require("../metadata-source");
const fs_1 = require("fs");
const exists_1 = require("../../exists");
const axios_1 = require("axios");
class LocalJson extends metadata_source_1.MetadataSource {
    /**
     * Normalize JSON data from file:
     * - Cover image buffer
     * - Album metadata
     */
    async normalize(metadatas, cover) {
        if (!metadatas || metadatas.length === 0) {
            return metadatas;
        }
        const [firstMetadata] = metadatas;
        const results = await Promise.all(metadatas.map(async (metadata, index) => {
            let coverBuffer = undefined;
            if (cover !== undefined) {
                coverBuffer = cover;
            }
            else if (typeof metadata.coverImage === 'string') {
                const response = await axios_1.default.get(metadata.coverImage, {
                    responseType: 'arraybuffer',
                    timeout: this.config.timeout * 1000,
                });
                coverBuffer = response.data;
            }
            metadata.coverImage = coverBuffer;
            if (index > 0) {
                const albumDataFields = [
                    'album',
                    'albumOrder',
                    'albumArtists',
                    'genres',
                    'year',
                    'coverImage',
                ];
                albumDataFields.forEach(field => {
                    if (!metadata[field]) {
                        metadata[field] = firstMetadata[field];
                    }
                });
            }
            return metadata;
        }));
        return results;
    }
    async resolveAlbumName(localSource) {
        return exists_1.resolvePath(localSource);
    }
    async getMetadata(fullPath, cover) {
        const jsonMetadata = JSON.parse(fs_1.readFileSync(fullPath, { encoding: 'utf8' }));
        const metadata = await this.normalize(jsonMetadata, cover);
        return metadata;
    }
}
exports.LocalJson = LocalJson;
exports.localJson = new LocalJson();
