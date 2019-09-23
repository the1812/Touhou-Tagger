#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const thb_wiki_1 = require("../core/metadata/thb-wiki");
const mp3_writer_1 = require("../core/writer/mp3-writer");
const readline = require("readline");
const path_1 = require("path");
const getMetadata = async (album) => {
    console.log(`下载专辑信息: ${album}`);
    const metadata = await thb_wiki_1.thbWiki.getMetadata(album);
    const files = fs_1.readdirSync('.').filter(file => file.endsWith('.mp3'));
    const targetFiles = files.map((_, index) => {
        const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2);
        return `${(index + 1).toString().padStart(maxLength, '0')} ${metadata[index].title}.mp3`;
    });
    console.log('创建文件中...');
    files.forEach((file, index) => {
        fs_1.renameSync(file, targetFiles[index]);
    });
    console.log('写入专辑信息...');
    await mp3_writer_1.mp3Writer.writeAll(metadata, targetFiles);
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
    const searchResult = await thb_wiki_1.thbWiki.resolveAlbumName(album);
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
