"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferNumberPlugin = void 0;
/** 自动推测 trackNumber 和 discNumber */
const inferNumberPlugin = () => {
    let cachedTrackNumber = 1;
    let cachedDiscNumber = 1;
    return ({ metadata }) => {
        if (metadata.discNumber && parseInt(metadata.discNumber) !== cachedDiscNumber) {
            cachedDiscNumber = parseInt(metadata.discNumber);
            cachedTrackNumber = 1;
        }
        if (!metadata.discNumber) {
            metadata.discNumber = cachedDiscNumber.toString();
        }
        if (!metadata.trackNumber) {
            metadata.trackNumber = cachedTrackNumber.toString();
        }
        cachedTrackNumber++;
    };
};
exports.inferNumberPlugin = inferNumberPlugin;
