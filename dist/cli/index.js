#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const readline = require("readline");
const path_1 = require("path");
const fs_1 = require("fs");
const commandLineArgs = require("command-line-args");
const cliOptions = commandLineArgs([
    { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
    { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' }
]);
const getMetadata = async (album) => {
    console.log(`下载专辑信息中: ${album}`);
    const { sourceMappings } = await Promise.resolve().then(() => require(`../core/metadata/source-mappings`));
    const metadata = await sourceMappings[cliOptions.source].getMetadata(album);
    console.log('创建文件中...');
    const { readdirSync, renameSync } = await Promise.resolve().then(() => require('fs'));
    const { writerMappings } = await Promise.resolve().then(() => require('../core/writer/writer-mappings'));
    const fileTypes = Object.keys(writerMappings);
    const files = readdirSync('.').filter(file => fileTypes.some(type => file.endsWith(type)));
    if (files.length === 0) {
        console.log('未找到任何支持的音乐文件.');
        process.exit();
    }
    const targetFiles = files.map((file, index) => {
        const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2);
        return `${(index + 1).toString().padStart(maxLength, '0')} ${metadata[index].title}${path_1.extname(file)}`;
    });
    files.forEach((file, index) => {
        renameSync(file, targetFiles[index]);
    });
    console.log('写入专辑信息中...');
    await Promise.all(targetFiles.map((file, index) => {
        console.log(file);
        const type = path_1.extname(file);
        return writerMappings[type].write(metadata[index], file);
    }));
    const coverBuffer = metadata[0].coverImage;
    if (cliOptions.cover && coverBuffer) {
        const imageType = await Promise.resolve().then(() => require('image-type'));
        const type = imageType(coverBuffer);
        if (type !== null) {
            const coverFilename = `cover.${type.ext}`;
            console.log(coverFilename);
            fs_1.writeFileSync(coverFilename, coverBuffer);
        }
    }
    console.log(`成功写入了专辑信息: ${album}`);
    process.exit();
};
const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const defaultAlbumName = path_1.basename(process.cwd());
reader.question(`请输入专辑名称(${defaultAlbumName}): `, async (album) => {
    if (!album) {
        album = defaultAlbumName;
    }
    console.log('搜索中...');
    const { sourceMappings } = await Promise.resolve().then(() => require(`../core/metadata/source-mappings`));
    const metadataSource = sourceMappings[cliOptions.source];
    if (!metadataSource) {
        console.log(`未找到与'${cliOptions.source}'相关联的数据源.`);
        process.exit();
    }
    const searchResult = await metadataSource.resolveAlbumName(album);
    if (typeof searchResult === 'string') {
        await getMetadata(album);
    }
    else {
        console.log('未找到匹配专辑, 以下是搜索结果:');
        console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'));
        reader.question('输入序号可选择相应条目, 或输入其他任意字符退出程序: ', async (answer) => {
            const index = parseInt(answer);
            if (isNaN(index) || index < 1 || index > searchResult.length) {
                process.exit();
            }
            await getMetadata(searchResult[index - 1]);
        });
    }
});
