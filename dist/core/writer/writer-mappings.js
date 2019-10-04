"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mp3_writer_1 = require("./mp3-writer");
const flac_writer_1 = require("./flac-writer");
exports.writerMappings = {
    '.mp3': mp3_writer_1.mp3Writer,
    '.flac': flac_writer_1.flacWriter,
};
