"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commandLineArgs = require("command-line-args");
const debug_1 = require("../core/debug");
exports.cliOptions = commandLineArgs([
    { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
    { name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
    { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' },
    { name: 'lyric', alias: 'l', type: Boolean, defaultValue: false },
    { name: 'lyric-type', alias: 't', type: String, defaultValue: 'original' },
    { name: 'lyric-output', alias: 'o', type: String, defaultValue: 'metadata' },
]);
debug_1.setDebug(exports.cliOptions.debug);
exports.metadataConfig = {
    lyric: exports.cliOptions.lyric ? {
        type: exports.cliOptions['lyric-type'],
        output: exports.cliOptions['lyric-output'],
    } : undefined
};
debug_1.log(exports.cliOptions, exports.metadataConfig);
