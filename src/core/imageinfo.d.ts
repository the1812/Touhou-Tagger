declare module 'imageinfo' {
  function imageinfo(data: Buffer): {
    readonly type: string
    readonly format: string
    readonly mimeType: string
    readonly width: number
    readonly height: number
  }
  export = imageinfo
}
