"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const spinner_1 = require("./spinner");
const path_1 = require("path");
const debug_1 = require("../core/debug");
exports.createFiles = async (metadata) => {
    const { readdirSync, renameSync } = await Promise.resolve().then(() => require('fs'));
    const { dirname } = await Promise.resolve().then(() => require('path'));
    const { writerMappings } = await Promise.resolve().then(() => require('../core/writer/writer-mappings'));
    const fileTypes = Object.keys(writerMappings);
    const fileTypeFilter = (file) => fileTypes.some(type => file.endsWith(type));
    const dir = readdirSync('.');
    const discFiles = dir.filter(f => f.match(/^Disc (\d+)/)).flatMap(f => readdirSync(f).map(inner => `${f}/${inner}`)).filter(fileTypeFilter);
    const files = dir.filter(fileTypeFilter).concat(discFiles).slice(0, metadata.length);
    if (files.length === 0) {
        spinner_1.spinner.fail('未找到任何支持的音乐文件.');
        // console.log('未找到任何支持的音乐文件.')
        process.exit();
    }
    const targetFiles = files.map((file, index) => {
        const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2);
        let dir = dirname(file);
        if (dir === '.') {
            dir = '';
        }
        else {
            dir += '/';
        }
        return dir + `${metadata[index].trackNumber.padStart(maxLength, '0')} ${metadata[index].title}${path_1.extname(file)}`.replace(/[\/\\:\*\?"<>\|]/g, '');
    });
    debug_1.log(files, targetFiles);
    files.forEach((file, index) => {
        renameSync(file, targetFiles[index]);
    });
    return targetFiles;
};
