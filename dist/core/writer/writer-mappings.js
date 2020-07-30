"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writerMappings = void 0;
const mp3_writer_1 = require("./mp3/mp3-writer");
const flac_writer_1 = require("./flac/flac-writer");
exports.writerMappings = {
    '.mp3': mp3_writer_1.mp3Writer,
    '.flac': flac_writer_1.flacWriter,
};
