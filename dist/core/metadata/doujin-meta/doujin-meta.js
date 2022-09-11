"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doujinMeta = exports.DoujinMeta = void 0;
const axios_1 = __importDefault(require("axios"));
const fuse_js_1 = __importDefault(require("fuse.js"));
const local_json_1 = require("../local-json/local-json");
const metadata_source_1 = require("../metadata-source");
const owner = 'the1812';
const repo = 'Doujin-Meta';
const githubApi = axios_1.default.create({
    headers: {
        Accept: 'application/vnd.github+json',
    },
    responseType: 'json',
});
class DoujinMeta extends metadata_source_1.MetadataSource {
    dataTree;
    fuse;
    async getDataTree() {
        const mainTreeApi = `https://api.github.com/repos/${owner}/${repo}/git/trees/main`;
        const { data: mainTree } = await githubApi.get(mainTreeApi);
        const dataFolder = mainTree.tree.find(it => it.path === 'data');
        if (!dataFolder) {
            throw new Error('获取 data 文件夹失败');
        }
        const { data: dataTree } = await githubApi.get(dataFolder.url);
        return dataTree;
    }
    init() {
        this.dataTree = this.getDataTree();
        this.fuse = this.dataTree.then(({ tree }) => new fuse_js_1.default(tree, {
            keys: ['path'],
            threshold: 0.4,
        }));
    }
    checkInitStatus() {
        if (!this.dataTree) {
            this.init();
        }
    }
    async findCover(nodes) {
        const allowedExtensions = ['.jpg', '.png'];
        const result = nodes.find(it => allowedExtensions.some(extension => it.path === `cover${extension}`));
        if (!result) {
            return undefined;
        }
        const { data: coverData } = await githubApi.get(result.url);
        return Buffer.from(coverData.content, 'base64');
    }
    async resolveAlbumName(albumName) {
        this.checkInitStatus();
        const fuse = await this.fuse;
        const result = fuse.search(albumName);
        if (result.length === 1) {
            return result[0].item.path;
        }
        return result.map(it => it.item.path).slice(0, 20);
    }
    async getMetadata(albumName, cover) {
        this.checkInitStatus();
        const { tree } = await this.dataTree;
        const node = tree.find(it => it.path === albumName);
        if (!node) {
            throw new Error(`data 目录中不存在 "${albumName}"`);
        }
        const { data: albumDetailTree } = await githubApi.get(node.url);
        const coverBuffer = cover ?? await this.findCover(albumDetailTree.tree);
        const metadataNode = albumDetailTree.tree.find(it => it.path === 'metadata.json');
        if (!metadataNode) {
            throw new Error(`${albumName} 元数据缺失`);
        }
        const { data: metadataTree } = await githubApi.get(metadataNode.url);
        const metadataJson = JSON.parse(Buffer.from(metadataTree.content, 'base64').toString('utf8'));
        return local_json_1.localJson.normalize(metadataJson, coverBuffer);
    }
}
exports.DoujinMeta = DoujinMeta;
exports.doujinMeta = new DoujinMeta();
