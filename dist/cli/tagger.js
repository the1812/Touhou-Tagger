"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliTagger = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const debug_1 = require("../core/debug");
const readline_1 = require("./readline");
const leadingNumberSort = (a, b) => {
    const infinityPrase = (str) => {
        const number = parseInt(str);
        if (Number.isNaN(number)) {
            return Infinity;
        }
        return number;
    };
    const intA = infinityPrase(a);
    const intB = infinityPrase(b);
    const intCompare = intA - intB;
    if (intCompare === 0) {
        return a.localeCompare(b);
    }
    return intCompare;
};
const TimeoutError = Symbol('timeout');
class CliTagger {
    constructor(cliOptions, metadataConfig, spinner) {
        this.cliOptions = cliOptions;
        this.metadataConfig = metadataConfig;
        this.spinner = spinner;
        this.workingDir = '.';
    }
    async getLocalCover() {
        const localCoverFiles = fs_1.readdirSync(this.workingDir, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.match(/^cover\.(jpg|jpeg|jpe|tif|tiff|bmp|png)$/))
            .map(f => f.name);
        if (localCoverFiles.length === 0) {
            return undefined;
        }
        const [coverFile] = localCoverFiles;
        const buffer = fs_1.readFileSync(path_1.resolve(this.workingDir, coverFile));
        return buffer;
    }
    async downloadMetadata(album, cover) {
        const { sourceMappings } = await Promise.resolve().then(() => require(`../core/metadata/source-mappings`));
        const metadataSource = sourceMappings[this.cliOptions.source];
        metadataSource.config = this.metadataConfig;
        this.metadataSource = metadataSource;
        return await this.metadataSource.getMetadata(album, cover);
    }
    async createFiles(metadata) {
        const { readdirSync, renameSync } = await Promise.resolve().then(() => require('fs'));
        const { dirname } = await Promise.resolve().then(() => require('path'));
        const { writerMappings } = await Promise.resolve().then(() => require('../core/writer/writer-mappings'));
        const fileTypes = Object.keys(writerMappings);
        const fileTypeFilter = (file) => fileTypes.some(type => file.endsWith(type));
        const dir = readdirSync(this.workingDir).sort(leadingNumberSort);
        const discFiles = dir
            .filter(f => f.match(/^Disc (\d+)/))
            .flatMap(f => readdirSync(path_1.resolve(this.workingDir, f))
            .sort(leadingNumberSort)
            .map(inner => `${f}/${inner}`))
            .filter(fileTypeFilter);
        const files = dir
            .filter(fileTypeFilter)
            .concat(discFiles)
            .slice(0, metadata.length)
            .map(f => path_1.resolve(this.workingDir, f));
        if (files.length === 0) {
            const message = '未找到任何支持的音乐文件.';
            this.spinner.fail(message);
            throw new Error(message);
        }
        const targetFiles = files.map((file, index) => {
            const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2);
            const filename = `${metadata[index].trackNumber.padStart(maxLength, '0')} ${metadata[index].title}${path_1.extname(file)}`.replace(/[\/\\:\*\?"<>\|]/g, '');
            return path_1.resolve(dirname(file), filename);
        });
        debug_1.log(files, targetFiles);
        files.forEach((file, index) => {
            renameSync(file, targetFiles[index]);
        });
        return targetFiles;
    }
    async writeMetadataToFile(metadata, targetFiles) {
        const { writerMappings } = await Promise.resolve().then(() => require('../core/writer/writer-mappings'));
        for (let i = 0; i < targetFiles.length; i++) {
            const file = targetFiles[i];
            debug_1.log(file);
            const type = path_1.extname(file);
            const writer = writerMappings[type];
            writer.config = this.metadataConfig;
            await writer.write(metadata[i], file);
            if (this.cliOptions.lyric && this.cliOptions['lyric-output'] === 'lrc' && metadata[i].lyric) {
                fs_1.writeFileSync(file.substring(0, file.lastIndexOf(type)) + '.lrc', metadata[i].lyric);
            }
        }
        // FLAC 那个库放 Promise.all 里就只有最后一个会运行???
        // await Promise.all(targetFiles.map((file, index) => {
        //   log(file)
        //   const type = extname(file)
        //   return writerMappings[type].write(metadata[index], file)
        // }))
        const coverBuffer = metadata[0].coverImage;
        if (this.cliOptions.cover && coverBuffer) {
            const imageType = await Promise.resolve().then(() => require('image-type'));
            const type = imageType(coverBuffer);
            if (type !== null) {
                const coverFilename = path_1.resolve(this.workingDir, `cover.${type.ext}`);
                debug_1.log('cover file', coverFilename);
                fs_1.writeFileSync(coverFilename, coverBuffer);
            }
        }
    }
    async withRetry(action) {
        let retryCount = 0;
        while (retryCount < this.cliOptions.retry) {
            try {
                const result = await Promise.race([
                    action(),
                    new Promise((_, reject) => setTimeout(() => reject(TimeoutError), this.cliOptions.timeout * 1000)),
                ]);
                return result;
            }
            catch (error) {
                retryCount++;
                const reason = (() => {
                    if (error === TimeoutError) {
                        return `操作超时(${this.cliOptions.timeout}秒)`;
                    }
                    if (!error) {
                        return '发生未知错误';
                    }
                    if (error.message) {
                        return error.message;
                    }
                    return error.toString();
                })();
                debug_1.log('\nretry get timeout', retryCount, reason);
                if (retryCount < this.cliOptions.retry) {
                    this.spinner.fail(`${reason}, 进行第${retryCount}次重试...`);
                }
                else {
                    throw new Error(reason);
                }
            }
        }
        throw new Error('发生未知错误');
    }
    async fetchMetadata(album) {
        return this.withRetry(async () => {
            const batch = this.cliOptions.batch;
            this.spinner.start(batch ? '下载专辑信息中' : `下载专辑信息中: ${album}`);
            const localCover = await this.getLocalCover();
            const metadata = await this.downloadMetadata(album, localCover);
            this.spinner.text = '创建文件中';
            const targetFiles = await this.createFiles(metadata);
            this.spinner.text = '写入专辑信息中';
            await this.writeMetadataToFile(metadata, targetFiles);
            this.spinner.succeed(batch ? '成功写入了专辑信息' : `成功写入了专辑信息: ${album}`);
        });
    }
    async run(album) {
        const { sourceMappings } = await Promise.resolve().then(() => require(`../core/metadata/source-mappings`));
        const metadataSource = sourceMappings[this.cliOptions.source];
        if (!metadataSource) {
            const message = `未找到与'${this.cliOptions.source}'相关联的数据源.`;
            this.spinner.fail(message);
            throw new Error(message);
        }
        metadataSource.config = this.metadataConfig;
        debug_1.log('searching');
        const handleError = (error) => {
            if (error instanceof Error) {
                this.spinner.fail(`错误: ${error.message}`);
            }
            else {
                throw error;
            }
        };
        const searchResult = await this.withRetry(() => {
            this.spinner.start('搜索中');
            return metadataSource.resolveAlbumName(album);
        }).catch(error => {
            handleError(error);
            return [];
        });
        debug_1.log('fetching metadata');
        if (typeof searchResult === 'string') {
            await this.fetchMetadata(album).catch(handleError);
        }
        else if (this.cliOptions['no-interactive']) {
            this.spinner.fail('未找到匹配专辑或有多个搜索结果');
        }
        else if (searchResult.length > 0) {
            this.spinner.fail('未找到匹配专辑, 以下是搜索结果:');
            console.log(searchResult.map((it, index) => `${index + 1}\t${it}`).join('\n'));
            const answer = await readline_1.readline('输入序号可选择相应条目, 或输入其他任意字符取消本次操作: ');
            const index = parseInt(answer);
            if (isNaN(index) || index < 1 || index > searchResult.length) {
                return;
            }
            await this.fetchMetadata(searchResult[index - 1]).catch(handleError);
        }
        else {
            this.spinner.fail('未找到匹配专辑, 且没有搜索结果, 请尝试使用更准确的专辑名称.');
        }
    }
}
exports.CliTagger = CliTagger;
