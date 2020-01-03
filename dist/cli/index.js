#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const readline = require("readline");
const path_1 = require("path");
const spinner_1 = require("./spinner");
const options_1 = require("./options");
const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const defaultAlbumName = path_1.basename(process.cwd());
reader.question(`请输入专辑名称(${defaultAlbumName}): `, async (album) => {
    if (!album) {
        album = defaultAlbumName;
    }
    await spinner_1.resetSpinner();
    const { sourceMappings } = await Promise.resolve().then(() => require(`../core/metadata/source-mappings`));
    const metadataSource = sourceMappings[options_1.cliOptions.source];
    if (!metadataSource) {
        spinner_1.spinner.fail(`未找到与'${options_1.cliOptions.source}'相关联的数据源.`);
        process.exit();
    }
    const searchResult = await metadataSource.resolveAlbumName(album);
    const handleError = (error) => {
        if (error instanceof Error) {
            spinner_1.spinner.fail(`错误: ${error.message}`);
            process.exit();
        }
        else {
            throw error;
        }
    };
    const { fetchMetadata } = await Promise.resolve().then(() => require('./fetch-metadata'));
    if (typeof searchResult === 'string') {
        await fetchMetadata(album).catch(handleError);
    }
    else if (searchResult.length > 0) {
        spinner_1.spinner.fail('未找到匹配专辑, 以下是搜索结果:');
        console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'));
        reader.question('输入序号可选择相应条目, 或输入其他任意字符退出程序: ', async (answer) => {
            const index = parseInt(answer);
            if (isNaN(index) || index < 1 || index > searchResult.length) {
                process.exit();
            }
            await fetchMetadata(searchResult[index - 1]).catch(handleError);
        });
    }
    else {
        spinner_1.spinner.fail('未找到匹配专辑, 且没有搜索结果, 请尝试使用更准确的专辑名称.');
        process.exit();
    }
});
