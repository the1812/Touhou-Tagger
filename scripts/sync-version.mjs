import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

import cliInfo from '../go/cmd/thtag/windows/info.json' with { type: 'json' }
import guiInfo from '../go/gui/build/windows/info.json' with { type: 'json' }
import pkg from '../package.json' with { type: 'json' }

const root = new URL('../', import.meta.url)
const { version } = pkg
const windowsVersion = `${version.split(/[+-]/u)[0]}.0`

const configPath = new URL('go/gui/build/config.yml', root)
const config = readFileSync(configPath, 'utf8')
writeFileSync(configPath, config.replace(/^ {2}version: .+$/mu, `  version: "${version}"`))

for (const { directory, manifest, info } of [
  { directory: 'go/cmd/thtag/windows/', manifest: 'thtag.exe.manifest', info: cliInfo },
  { directory: 'go/gui/build/windows/', manifest: 'wails.exe.manifest', info: guiInfo },
]) {
  const infoPath = new URL(`${directory}info.json`, root)
  info.fixed.file_version = windowsVersion
  info.fixed.product_version = windowsVersion
  info.info['0409'].FileVersion = version
  info.info['0409'].ProductVersion = version
  writeFileSync(infoPath, `${JSON.stringify(info, null, 2)}\n`)

  const manifestPath = new URL(`${directory}${manifest}`, root)
  const content = readFileSync(manifestPath, 'utf8')
  writeFileSync(
    manifestPath,
    content.replace(
      /(?<identity><assemblyIdentity\b[^>]*\bversion=")[^"]+/u,
      `$<identity>${windowsVersion}`,
    ),
  )
}

execFileSync(
  'go',
  [
    'tool',
    'wails3',
    'generate',
    'syso',
    '-icon',
    '../assets/logo.ico',
    '-manifest',
    'cmd/thtag/windows/thtag.exe.manifest',
    '-info',
    'cmd/thtag/windows/info.json',
    '-arch',
    'amd64',
    '-out',
    'cmd/thtag/resource_windows_amd64.syso',
  ],
  { cwd: new URL('go/', root), stdio: 'inherit' },
)

console.log(`Synchronized release version ${version}`)
