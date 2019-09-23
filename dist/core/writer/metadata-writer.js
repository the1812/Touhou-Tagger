"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MetadataWriter {
    async writeAll(metadatas, filePaths) {
        await Promise.all(metadatas.map((metadata, index) => {
            const filePath = filePaths[index];
            return this.write(metadata, filePath);
        }));
    }
    async updateAll(metadatas, filePaths) {
        await Promise.all(metadatas.map((metadata, index) => {
            const filePath = filePaths[index];
            return this.update(metadata, filePath);
        }));
    }
}
exports.MetadataWriter = MetadataWriter;
