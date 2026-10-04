import album from '../../../../../../fixtures/thb-wiki/albums/single-disc/expected.json'
import type { DumpApi } from '../api/types'
import { workspaceSummary } from './data'
import { wait } from './state'

export const fixtureDumpApi: DumpApi = {
  async scanDump(directory) {
    await wait(160)
    return {
      directory,
      name: directory.split(/[\\/]/).at(-1) ?? directory,
      audioCount: workspaceSummary.audioCount,
      mp3Count: workspaceSummary.mp3Count,
      flacCount: workspaceSummary.flacCount,
      json: JSON.stringify(album.tracks, null, 2),
    }
  },
  async selectDumpOutput(directory, saveAs) {
    await wait()
    return `${directory}/${saveAs ? 'export' : 'metadata'}.json`
  },
  async dumpMetadata(_directory, path) {
    await wait(500)
    return {
      directory: path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))),
      audioCount: workspaceSummary.audioCount,
    }
  },
}
