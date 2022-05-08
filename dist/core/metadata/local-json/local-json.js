"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localJson = exports.LocalJson = void 0;
const metadata_source_1 = require("../metadata-source");
const fs_1 = require("fs");
const exists_1 = require("../../exists");
const infer_number_1 = require("./infer-number");
const common_fields_1 = require("./common-fields");
const cover_1 = require("./cover");
const omit_artists_1 = require("./omit-artists");
const plugins = [cover_1.fetchCoverPlugin, omit_artists_1.omitArtistsPlugin, infer_number_1.inferNumberPlugin, common_fields_1.commonFieldsPlugin];
class LocalJson extends metadata_source_1.MetadataSource {
    async normalize(metadatas, cover) {
        if (!metadatas || metadatas.length === 0) {
            return metadatas;
        }
        const pluginInstances = plugins.map(p => p({ cover, config: this.config }));
        const results = await Promise.all(metadatas.map(async (metadata, index) => {
            for (const instance of pluginInstances) {
                await instance({
                    metadata,
                    index,
                });
            }
            return metadata;
        }));
        return results;
    }
    async resolveAlbumName(localSource) {
        return (0, exists_1.resolvePath)(localSource);
    }
    async getMetadata(fullPath, cover) {
        const jsonMetadata = JSON.parse((0, fs_1.readFileSync)(fullPath, { encoding: 'utf8' }));
        const metadata = await this.normalize(jsonMetadata, cover);
        return metadata;
    }
}
exports.LocalJson = LocalJson;
exports.localJson = new LocalJson();
