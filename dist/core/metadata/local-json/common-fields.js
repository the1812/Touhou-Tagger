"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonFieldsPlugin = void 0;
/** 记录第一个 metadata 的公共字段, 后续可省略 */
const commonFieldsPlugin = () => {
    let firstMetadata;
    return ({ metadata, index }) => {
        if (index === 0) {
            firstMetadata = metadata;
        }
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
    };
};
exports.commonFieldsPlugin = commonFieldsPlugin;
