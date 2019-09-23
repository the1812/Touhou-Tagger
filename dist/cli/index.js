#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const readline = require("readline");
const path_1 = require("path");
const getMetadata = async (album) => {
    console.log(`下载专辑信息中: ${album}`);
    const { thbWiki } = await Promise.resolve().then(() => require('../core/metadata/thb-wiki'));
    const metadata = await thbWiki.getMetadata(album);
    console.log('创建文件中...');
    const { readdirSync, renameSync } = await Promise.resolve().then(() => require('fs'));
    const writerMappings = (await Promise.resolve().then(() => require('../core/writer/writer-mappings'))).default;
    const fileTypes = Object.keys(writerMappings);
    const files = readdirSync('.').filter(file => fileTypes.some(type => file.endsWith(type)));
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
    const { thbWiki } = await Promise.resolve().then(() => require('../core/metadata/thb-wiki'));
    const searchResult = await thbWiki.resolveAlbumName(album);
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
