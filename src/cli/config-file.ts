import { homedir } from 'os'
import { join } from 'path'
import {
  closeSync,
  existsSync,
  ftruncateSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'fs'
import { MetadataConfig } from '../core/core-config'

export const filePath = join(homedir(), '.thtag.json')
export const loadConfigFile = () => {
  if (!existsSync(filePath)) {
    return null
  }
  return JSON.parse(readFileSync(filePath, { encoding: 'utf8' })) as MetadataConfig
}
export const saveConfigFile = (config: MetadataConfig) => {
  const content = JSON.stringify(config, undefined, 2)
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
