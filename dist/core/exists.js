"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePath = void 0;
const resolvePath = async (path) => {
    const { resolve } = await Promise.resolve().then(() => require('path'));
    const { existsSync } = await Promise.resolve().then(() => require('fs'));
    const localSourcePath = resolve(path).replace(/\\/g, '/');
    if (!existsSync(localSourcePath)) {
        throw new Error('路径不存在');
    }
    return localSourcePath;
};
exports.resolvePath = resolvePath;
