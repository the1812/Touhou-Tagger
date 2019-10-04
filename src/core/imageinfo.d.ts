declare module 'imageinfo' {
  function imageinfo(data: Buffer): {
    type: string
    format: string
    mimeType: string
    width: number
    height: number
  }
  export = imageinfo
}