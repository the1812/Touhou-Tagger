"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveConfigFile = exports.loadConfigFile = exports.filePath = void 0;
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
exports.filePath = path_1.join(os_1.homedir(), '.thtag.json');
exports.loadConfigFile = () => {
    if (!fs_1.existsSync(exports.filePath)) {
        return null;
    }
    return JSON.parse(fs_1.readFileSync(exports.filePath, { encoding: 'utf-8' }));
};
exports.saveConfigFile = (config) => {
    fs_1.writeFileSync(exports.filePath, JSON.stringify(config, undefined, 2));
};
