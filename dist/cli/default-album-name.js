"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultAlbumName = void 0;
const path_1 = require("path");
const specialFormats = [
    {
        name: 'TLMC',
        regex: /^([\d\.]+)\s*(\[.+\])?\s*(.+?)\s*(\[.+\])?$/,
        resolve: match => match[3],
    },
    {
        name: 'Default',
        regex: /.+/,
        resolve: match => match[0]
    },
];
exports.getDefaultAlbumName = () => {
    const currentFolder = path_1.basename(process.cwd());
    const [formatMatch] = specialFormats.map(f => {
        const match = currentFolder.match(f.regex);
        if (match) {
            return f.resolve(match);
        }
        return null;
    }).filter((it) => it !== null);
    return formatMatch || currentFolder;
};
