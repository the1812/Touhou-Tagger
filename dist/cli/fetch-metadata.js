"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const spinner_1 = require("./spinner");
const download_metadata_1 = require("./download-metadata");
const create_files_1 = require("./create-files");
const write_metadata_1 = require("./write-metadata");
exports.fetchMetadata = async (album) => {
    spinner_1.spinner.start(`下载专辑信息中: ${album}`);
    const metadata = await download_metadata_1.downloadMetadata(album);
    spinner_1.spinner.text = '创建文件中';
    const targetFiles = await create_files_1.createFiles(metadata);
    spinner_1.spinner.text = '写入专辑信息中';
    await write_metadata_1.writeMetadata(metadata, targetFiles);
    spinner_1.spinner.succeed(`成功写入了专辑信息: ${album}`);
    process.exit();
};
