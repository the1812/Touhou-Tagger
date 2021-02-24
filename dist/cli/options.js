"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataConfig = exports.lyricConfig = exports.cliOptions = void 0;
const commandLineArgs = require("command-line-args");
const core_config_1 = require("../core/core-config");
const debug_1 = require("../core/debug");
const config_file_1 = require("./config-file");
const options = commandLineArgs([
    { name: 'cover', alias: 'c', type: Boolean, defaultValue: false },
    { name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
    { name: 'source', alias: 's', type: String, defaultValue: 'thb-wiki' },
    { name: 'lyric', alias: 'l', type: Boolean, defaultValue: false },
    { name: 'batch', alias: 'b', type: String, defaultValue: '' },
    { name: 'separator', type: String, defaultValue: core_config_1.DefaultMetadataSeparator },
    { name: 'timeout', type: Number, defaultValue: 120 },
    { name: 'retry', type: Number, defaultValue: 3 },
    { name: 'lyric-type', alias: 't', type: String },
    { name: 'lyric-output', alias: 'o', type: String },
    { name: 'no-lyric-time', alias: 'T', type: Boolean, defaultValue: false },
    { name: 'no-interactive', alias: 'I', type: Boolean, defaultValue: false },
]);
debug_1.setDebug(options.debug);
const configFile = config_file_1.loadConfigFile();
if (configFile !== null) {
    debug_1.log('config file: ', configFile);
    const { lyric, ...restConfig } = configFile;
    if (lyric !== undefined) {
        if (options['lyric-output'] === undefined) {
            options['lyric-output'] = lyric.output;
        }
        if (options['lyric-type'] === undefined) {
            options['lyric-type'] = lyric.type;
        }
        options['translation-separator'] = lyric.translationSeparator;
    }
    Object.assign(options, restConfig);
}
const lyric = {
    type: options['lyric-type'] || 'original',
    output: options['lyric-output'] || 'metadata',
    time: !options['no-lyric-time'],
    translationSeparator: options['translation-separator'] || ' // '
};
const metadata = {
    lyric: options.lyric ? lyric : undefined,
    separator: options.separator,
    timeout: options.timeout,
    retry: options.retry,
};
debug_1.log(options);
debug_1.log(metadata);
config_file_1.saveConfigFile({ ...metadata, lyric });
exports.cliOptions = options;
exports.lyricConfig = lyric;
exports.metadataConfig = metadata;
