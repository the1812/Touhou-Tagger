import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

import { MetadataConfig } from '../core/core-config'

export const legacyFilePath = join(homedir(), '.thtag.json')
export const filePath = (() => {
  switch (process.platform) {
    case 'win32':
      return join(
        process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
        'Touhou Tagger',
        'config.json',
      )
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'Touhou Tagger', 'config.json')
    default:
      return join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
        'touhou-tagger',
        'config.json',
      )
  }
})()
export const loadConfigFile = () => {
  const configPath = existsSync(filePath) ? filePath : legacyFilePath
  if (!existsSync(configPath)) {
    return null
  }
  return JSON.parse(readFileSync(configPath, { encoding: 'utf8' })) as MetadataConfig
}
export const saveConfigFile = (config: MetadataConfig) => {
  const content = JSON.stringify(config, undefined, 2)
  mkdirSync(dirname(filePath), { recursive: true })
  if (!existsSync(filePath)) {
    writeFileSync(filePath, content)
    return
  }
  const fd = openSync(filePath, 'r+')
  try {
    ftruncateSync(fd, 0)
    writeSync(fd, content)
  } finally {
    closeSync(fd)
  }
}
