import { MetadataConfig } from '../core-config.js'
import { Metadata } from '../metadata/metadata.js'

export abstract class MetadataReader<RawType = unknown> {
  declare config: MetadataConfig
  abstract read(input: string | Buffer | RawType): Promise<Metadata>
  abstract readRaw(input: string | Buffer): Promise<RawType>
  async readAll(inputs: (string | Buffer | RawType)[]) {
    return Promise.all(
      inputs.map(it => {
        return this.read(it)
      }),
    )
  }
}
