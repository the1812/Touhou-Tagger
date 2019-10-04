import { Metadata } from '../metadata/metadata';

export abstract class MetadataWriter {
  abstract write(metadata: Metadata, filePath: string): Promise<void>
  // abstract update(metadata: Metadata, filePath: string): Promise<void>
  async writeAll(metadatas: Metadata[], filePaths: string[]) {
    await Promise.all(metadatas.map((metadata, index) => {
      const filePath = filePaths[index]
      return this.write(metadata, filePath)
    }))
  }
  // async updateAll(metadatas: Metadata[], filePaths: string[]) {
  //   await Promise.all(metadatas.map((metadata, index) => {
  //     const filePath = filePaths[index]
  //     return this.update(metadata, filePath)
  //   }))
  // }
}