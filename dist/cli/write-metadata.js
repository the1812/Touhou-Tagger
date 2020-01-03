"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const options_1 = require("./options");
const fs_1 = require("fs");
const debug_1 = require("../core/debug");
exports.writeMetadata = async (metadata, targetFiles) => {
    const { writerMappings } = await Promise.resolve().then(() => require('../core/writer/writer-mappings'));
    for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        debug_1.log(file);
        const type = path_1.extname(file);
        const writer = writerMappings[type];
        writer.config = options_1.metadataConfig;
        await writer.write(metadata[i], file);
        if (options_1.cliOptions.lyric && options_1.cliOptions['lyric-output'] === 'lrc' && metadata[i].lyric) {
            fs_1.writeFileSync(file.substring(0, file.lastIndexOf(type)) + '.lrc', metadata[i].lyric);
        }
    }
    // FLAC 那个库放 Promise.all 里就只有最后一个会运行???
    // await Promise.all(targetFiles.map((file, index) => {
    //   log(file)
    //   const type = extname(file)
    //   return writerMappings[type].write(metadata[index], file)
    // }))
    const coverBuffer = metadata[0].coverImage;
    if (options_1.cliOptions.cover && coverBuffer) {
        const imageType = await Promise.resolve().then(() => require('image-type'));
        const type = imageType(coverBuffer);
        if (type !== null) {
            const coverFilename = `cover.${type.ext}`;
            debug_1.log(coverFilename);
            fs_1.writeFileSync(coverFilename, coverBuffer);
        }
    }
};
