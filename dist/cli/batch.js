"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBatchTagger = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const debug_1 = require("../core/debug");
const default_album_name_1 = require("./default-album-name");
const options_1 = require("./options");
const runBatchTagger = async (folder) => {
    const albums = (0, fs_1.readdirSync)(folder, { withFileTypes: true })
        .filter(dir => dir.isDirectory())
        .map(dir => dir.name);
    const albumCount = albums.length;
    const { CliTagger } = await Promise.resolve().then(() => require('./tagger'));
    const ora = await Promise.resolve().then(() => require('ora'));
    for (let index = 0; index < albumCount; index++) {
        try {
            const album = (0, default_album_name_1.getDefaultAlbumName)(albums[index]);
            const spinner = ora({
                text: '搜索中',
                spinner: {
                    interval: 500,
                    frames: ['.  ', '.. ', '...']
                }
            }).start();
            spinner.prefixText = `[${album}] (${index + 1}/${albumCount})`;
            (0, debug_1.log)(`start processing album #${index + 1}`);
            const tagger = new CliTagger(options_1.cliOptions, options_1.metadataConfig, spinner);
            tagger.workingDir = (0, path_1.resolve)(options_1.cliOptions.batch, albums[index]);
            await tagger.run(album);
            (0, debug_1.log)(`processed album #${index + 1}`);
        }
        catch (error) {
            (0, debug_1.log)('batch error:', error.message);
            continue;
        }
    }
    process.exit();
};
exports.runBatchTagger = runBatchTagger;
