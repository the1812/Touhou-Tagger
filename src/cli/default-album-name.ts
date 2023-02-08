import { basename } from 'path'

interface SpecialFormat {
  name: string
  regex: RegExp
  resolve: (match: RegExpMatchArray) => string
}
const specialFormats: SpecialFormat[] = [
  {
    name: 'TlmcWithDiscId',
    regex: /\[.+?\]$/,
    resolve: match => match[1],
  },
  {
    name: 'Tlmc',
    regex: /^[\d]{4}\.[\d]{2}\.[\d]{2} (.+?) \[.+?\]$/,
    resolve: match => match[1],
  },
  {
    name: 'Default',
    regex: /.+/,
    resolve: match => match[0]
  },
]
export const getDefaultAlbumName = (currentFolder: string = basename(process.cwd())) => {
  const [formatMatch] = specialFormats.map(f => {
    const match = currentFolder.match(f.regex)
    if (match) {
      return f.resolve(match)
    }
    return null
  }).filter((it): it is string => it !== null)
  return formatMatch || currentFolder
}
