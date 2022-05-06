#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const options_1 = require("./options");
const readline_1 = require("../core/readline");
const default_album_name_1 = require("./default-album-name");
let spinner;
const runTagger = async (album) => {
    const { default: ora } = await Promise.resolve().then(() => __importStar(require('ora')));
    if (!spinner) {
        spinner = ora({
            text: '搜索中',
            spinner: {
                interval: 500,
                frames: ['.  ', '.. ', '...']
            }
        }).start();
    }
    const { CliTagger } = await Promise.resolve().then(() => __importStar(require('./tagger')));
    const tagger = new CliTagger(options_1.cliOptions, options_1.metadataConfig, spinner);
    await tagger.run(album);
    process.exit();
};
const defaultAlbumName = (0, default_album_name_1.getDefaultAlbumName)();
if (options_1.cliOptions.batch) {
    Promise.resolve().then(() => __importStar(require('./batch'))).then(({ runBatchTagger }) => {
        runBatchTagger(options_1.cliOptions.batch, options_1.cliOptions.batchDepth);
    });
}
else if (options_1.cliOptions['no-interactive']) {
    runTagger(defaultAlbumName);
}
else {
    (0, readline_1.readline)(`请输入专辑名称(${defaultAlbumName}): `).then(album => {
        runTagger(album || defaultAlbumName);
    });
}
