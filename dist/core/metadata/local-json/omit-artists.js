"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omitArtistsPlugin = void 0;
/** 省略 artists 且带有 composers 时, 使用 composers 填充 artists */
const omitArtistsPlugin = () => {
    return ({ metadata }) => {
        if (!metadata.artists && metadata.composers) {
            metadata.artists = metadata.composers;
        }
    };
};
exports.omitArtistsPlugin = omitArtistsPlugin;
