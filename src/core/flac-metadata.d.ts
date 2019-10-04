declare module 'flac-metadata' {
  export interface ProcessorOption {
    parseMetaDataBlocks?: boolean
  }
  export class Processor implements NodeJS.WritableStream {
    writable: boolean;
    write(buffer: string | Uint8Array, cb?: ((err?: Error | null | undefined) => void) | undefined): boolean;
    write(str: string, encoding?: string | undefined, cb?: ((err?: Error | null | undefined) => void) | undefined): boolean;
    end(cb?: (() => void) | undefined): void;
    end(data: string | Uint8Array, cb?: (() => void) | undefined): void;
    end(str: string, encoding?: string | undefined, cb?: (() => void) | undefined): void;
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol | undefined): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(event: string | symbol): Function[];
    rawListeners(event: string | symbol): Function[];
    emit(event: string | symbol, ...args: any[]): boolean;
    listenerCount(type: string | symbol): number;
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
    eventNames(): (string | symbol)[];
    constructor(options?: ProcessorOption);
    static MDB_TYPE_STREAMINFO: number;
    static MDB_TYPE_VORBIS_COMMENT: number;
    static MDB_TYPE_PICTURE: number;
  }
  namespace data {
    export class MetaDataBlockVorbisComment {
      static create(last: boolean, vendor: string, comments: string[]): {
        publish: () => any
      }
    }
    export class MetaDataBlockPicture {
      static create(
        last: boolean,
        pictureType: number,
        mimeType: string,
        description: string,
        width: number,
        height: number,
        bitsPerPixel: number,
        colors: number,
        pictureData: Buffer): {
          publish: () => any
        }
    }
  }
}
