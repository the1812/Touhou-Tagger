"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataWriter = void 0;
class MetadataWriter {
    constructor() {
        this.config = {};
        // async updateAll(metadatas: Metadata[], filePaths: string[]) {
        //   await Promise.all(metadatas.map((metadata, index) => {
        //     const filePath = filePaths[index]
        //     return this.update(metadata, filePath)
        //   }))
        // }
    }
    // abstract update(metadata: Metadata, filePath: string): Promise<void>
    async writeAll(metadatas, filePaths) {
        await Promise.all(metadatas.map((metadata, index) => {
            const filePath = filePaths[index];
            return this.write(metadata, filePath);
        }));
    }
}
exports.MetadataWriter = MetadataWriter;
