"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBatchTagger = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const options_1 = require("./options");
let spinner;
exports.runBatchTagger = async (folder) => {
    const albums = fs_1.readdirSync(folder, { withFileTypes: true })
        .filter(dir => dir.isDirectory())
        .map(dir => dir.name);
    const albumCount = albums.length;
    const { CliTagger } = await Promise.resolve().then(() => require('./tagger'));
    const ora = await Promise.resolve().then(() => require('ora'));
    if (!spinner) {
        spinner = ora({
            text: '搜索中',
            spinner: {
                interval: 500,
                frames: ['.  ', '.. ', '...']
            }
        }).start();
        spinner.prefixText = `[] (0/${albumCount})`;
    }
    for (let index = 0; index < albumCount; index++) {
        try {
            const album = albums[index];
            spinner.prefixText = `[${album}] (${index + 1}/${albumCount})`;
            const tagger = new CliTagger(options_1.cliOptions, options_1.metadataConfig, spinner);
            tagger.workingDir = path_1.resolve(options_1.cliOptions.batch, album);
            await tagger.run(album);
        }
        catch (error) {
            continue;
        }
    }
    process.exit();
};
