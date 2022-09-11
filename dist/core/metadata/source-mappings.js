"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceMappings = void 0;
const thb_wiki_1 = require("./thb-wiki/thb-wiki");
const local_mp3_1 = require("./local-mp3/local-mp3");
const local_json_1 = require("./local-json/local-json");
const doujin_meta_1 = require("./doujin-meta/doujin-meta");
exports.sourceMappings = {
    'thb-wiki': thb_wiki_1.thbWiki,
    'local-mp3': local_mp3_1.localMp3,
    'local-json': local_json_1.localJson,
    'doujin-meta': doujin_meta_1.doujinMeta,
};
