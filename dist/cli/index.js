#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const options_1 = require("./options");
const readline_1 = require("./readline");
let spinner;
const runTagger = async (album) => {
    const ora = await Promise.resolve().then(() => require('ora'));
    if (!spinner) {
        spinner = ora({
            text: '搜索中',
            spinner: {
                interval: 500,
                frames: ['.  ', '.. ', '...']
            }
        }).start();
    }
    const { CliTagger } = await Promise.resolve().then(() => require('./tagger'));
    const tagger = new CliTagger(options_1.cliOptions, options_1.metadataConfig, spinner);
    await tagger.run(album);
    process.exit();
};
const defaultAlbumName = path_1.basename(process.cwd());
if (options_1.cliOptions.batch) {
    Promise.resolve().then(() => require('./batch')).then(({ runBatchTagger }) => {
        runBatchTagger(options_1.cliOptions.batch);
    });
}
else if (options_1.cliOptions['no-interactive']) {
    runTagger(defaultAlbumName);
}
else {
    readline_1.readline(`请输入专辑名称(${defaultAlbumName}): `).then(album => {
        runTagger(album || defaultAlbumName);
    });
}
