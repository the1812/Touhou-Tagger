"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./writer/metadata-writer"), exports);
__exportStar(require("./writer/mp3/mp3-writer"), exports);
__exportStar(require("./writer/flac/flac-writer"), exports);
__exportStar(require("./writer/writer-mappings"), exports);
__exportStar(require("./metadata/metadata"), exports);
__exportStar(require("./metadata/metadata-source"), exports);
__exportStar(require("./metadata/source-mappings"), exports);
__exportStar(require("./metadata/thb-wiki/thb-wiki"), exports);
