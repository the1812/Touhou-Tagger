import { MetadataConfig } from '../core-config'
import { Metadata } from '../metadata/metadata'

export abstract class MetadataReader<RawType = unknown> {
  config: MetadataConfig
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
