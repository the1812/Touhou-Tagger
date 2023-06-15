import { MetadataConfig } from '../core-config'
import { Metadata } from '../metadata/metadata';

export abstract class MetadataReader {
  config: MetadataConfig
  abstract read(filePath: string): Promise<Metadata>
  async readAll(filePaths: string[]) {
    return Promise.all(filePaths.map((filePath) => {
      return this.read(filePath)
    }))
  }
}
