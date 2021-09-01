import { basename } from 'path'

interface SpecialFormat {
  name: string
  regex: RegExp
  resolve: (match: RegExpMatchArray) => string
}
const specialFormats: SpecialFormat[] = [
  {
    name: 'TLMC',
    regex: /^([\d\.]+)\s*(\[.+\])?\s*(.+?)\s*(\[.+\])?$/,
    resolve: match => match[3],
  },
  {
    name: 'Default',
    regex: /.+/,
    resolve: match => match[0]
  },
]
export const getDefaultAlbumName = () => {
  const currentFolder = basename(process.cwd())
  const [formatMatch] = specialFormats.map(f => {
    const match = currentFolder.match(f.regex)
    if (match) {
      return f.resolve(match)
    }
    return null
  }).filter((it): it is string => it !== null)
  return formatMatch || currentFolder
}
