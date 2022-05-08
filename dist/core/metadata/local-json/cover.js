"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCoverPlugin = void 0;
const axios_1 = __importDefault(require("axios"));
/** 处理封面图片 */
const fetchCoverPlugin = ({ cover, config }) => {
    let firstCoverBuffer = undefined;
    const downloadRemoteCover = async (url) => {
        return axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: config.timeout * 1000,
        });
    };
    return async ({ metadata, index }) => {
        if (index === 0) {
            if (cover !== undefined) {
                firstCoverBuffer = cover;
            }
            else if (typeof metadata.coverImage === 'string') {
                const response = await downloadRemoteCover(metadata.coverImage);
                firstCoverBuffer = response.data;
            }
            metadata.coverImage = firstCoverBuffer;
        }
        if (index > 0) {
            if (metadata.coverImage === undefined && firstCoverBuffer !== undefined) {
                metadata.coverImage = firstCoverBuffer;
            }
            else if (typeof metadata.coverImage === 'string') {
                const response = await downloadRemoteCover(metadata.coverImage);
                metadata.coverImage = response.data;
            }
        }
    };
};
exports.fetchCoverPlugin = fetchCoverPlugin;
