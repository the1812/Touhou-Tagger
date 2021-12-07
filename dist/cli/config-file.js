"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveConfigFile = exports.loadConfigFile = exports.filePath = void 0;
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
exports.filePath = (0, path_1.join)((0, os_1.homedir)(), '.thtag.json');
const loadConfigFile = () => {
    if (!(0, fs_1.existsSync)(exports.filePath)) {
        return null;
    }
    return JSON.parse((0, fs_1.readFileSync)(exports.filePath, { encoding: 'utf8' }));
};
exports.loadConfigFile = loadConfigFile;
const saveConfigFile = (config) => {
    (0, fs_1.writeFileSync)(exports.filePath, JSON.stringify(config, undefined, 2));
};
exports.saveConfigFile = saveConfigFile;
