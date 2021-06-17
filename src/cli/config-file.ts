import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { MetadataConfig } from '../core/core-config'

export const filePath = join(homedir(), '.thtag.json')
export const loadConfigFile = () => {
  if (!existsSync(filePath)) {
    return null
  }
  return JSON.parse(readFileSync(filePath, { encoding: 'utf8' })) as MetadataConfig
}
export const saveConfigFile = (config: MetadataConfig) => {
  writeFileSync(filePath, JSON.stringify(config, undefined, 2))
}