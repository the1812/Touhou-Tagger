"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.runBatchTagger = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const debug_1 = require("../core/debug");
const default_album_name_1 = require("./default-album-name");
const options_1 = require("./options");
const readFolder = (folder, depth) => {
    const currentSubFolders = (0, fs_1.readdirSync)(folder, { withFileTypes: true })
        .filter(dir => dir.isDirectory())
        .map(dir => ({
        name: dir.name,
        path: (0, path_1.join)(folder, dir.name),
    }));
    if (depth <= 1) {
        return currentSubFolders;
    }
    return currentSubFolders.flatMap(subFolder => readFolder((0, path_1.join)(folder, subFolder.name), depth - 1));
};
const runBatchTagger = async (folder, depth) => {
    const albums = readFolder(folder, depth);
    const albumCount = albums.length;
    const { CliTagger } = await Promise.resolve().then(() => __importStar(require('./tagger')));
    const { default: ora } = await Promise.resolve().then(() => __importStar(require('ora')));
    for (let index = 0; index < albumCount; index++) {
        try {
            const album = (0, default_album_name_1.getDefaultAlbumName)(albums[index].name);
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
            tagger.workingDir = albums[index].path;
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
