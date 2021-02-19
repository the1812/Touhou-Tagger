"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataConfig = exports.lyricConfig = exports.cliOptions = void 0;
const commandLineArgs = require("command-line-args");
const debug_1 = require("../core/debug");
const config_file_1 = require("./config-file");
const options = commandLineArgs([
    { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
    { name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
    { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' },
    { name: 'lyric', alias: 'l', type: Boolean, defaultValue: false },
    { name: 'batch', alias: 'b', type: String, defaultValue: '' },
    { name: 'lyric-type', alias: 't', type: String },
    { name: 'lyric-output', alias: 'o', type: String },
    { name: 'no-lyric-time', alias: 'T', type: Boolean, defaultValue: false },
    { name: 'no-interactive', alias: 'I', type: Boolean, defaultValue: false },
]);
if (options.batch) {
    options['no-interactive'] = true;
}
debug_1.setDebug(options.debug);
const configFile = config_file_1.loadConfigFile();
if (configFile !== null) {
    debug_1.log('config file: ', configFile);
    if (configFile.lyric !== undefined) {
        if (options['lyric-output'] === undefined) {
            options['lyric-output'] = configFile.lyric.output;
        }
        if (options['lyric-type'] === undefined) {
            options['lyric-type'] = configFile.lyric.type;
        }
        options['translation-separator'] = configFile.lyric.translationSeparator;
    }
}
const lyric = {
    type: options['lyric-type'] || 'original',
    output: options['lyric-output'] || 'metadata',
    time: !options['no-lyric-time'],
    translationSeparator: options['translation-separator'] || ' // '
};
const metadata = {
    lyric: options.lyric ? lyric : undefined
};
debug_1.log(options, metadata);
config_file_1.saveConfigFile({ lyric });
exports.cliOptions = options;
exports.lyricConfig = lyric;
exports.metadataConfig = metadata;
