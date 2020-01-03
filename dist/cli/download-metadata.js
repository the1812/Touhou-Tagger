"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const options_1 = require("./options");
exports.downloadMetadata = async (album) => {
    const { sourceMappings } = await Promise.resolve().then(() => require(`../core/metadata/source-mappings`));
    const metadataSource = sourceMappings[options_1.cliOptions.source];
    metadataSource.config = options_1.metadataConfig;
    return await metadataSource.getMetadata(album);
};
