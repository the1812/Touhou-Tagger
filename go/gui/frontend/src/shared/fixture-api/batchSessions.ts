import type { BatchPreview } from '../api/types'
import { batchEntries } from './batchData'
import { clone, fixtureState } from './state'

const directoryKey = (directory: string) =>
  directory.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase()

export const appendFixtureDirectories = (batch: BatchPreview, directories: string[], root = '') => {
  const known = batch.entries.map(entry => entry.directory)
  const added: string[] = []
  for (const directory of directories) {
    const key = directoryKey(directory)
    if (known.some(path => directoryKey(path) === key)) {
      continue
    }
    const conflict = known.find(
      path => key.startsWith(`${directoryKey(path)}/`) || directoryKey(path).startsWith(`${key}/`),
    )
    if (conflict) {
      throw new Error(`不能同时选择父目录和子目录：${conflict}、${directory}`)
    }
    known.push(directory)
    added.push(directory)
  }
  const templates = batchEntries()
  for (const directory of added) {
    const name = directory.replaceAll('\\', '/').split('/').at(-1) ?? ''
    const template = templates.find(entry => entry.inferredAlbumName === name) ?? templates[0]
    fixtureState.entrySequence += 1
    const entry = {
      ...clone(template),
      id: `fixture-entry-${String(fixtureState.entrySequence)}`,
      directory,
      relativePath: root ? name : '',
      inferredAlbumName: name,
    }
    fixtureState.batchEntries.set(entry.id, entry)
    batch.entries.push({
      ...entry,
      readiness: 'pending',
      candidates: [],
      issues: [],
      selectedCandidateId: undefined,
    })
  }
}

export const createFixtureBatch = (directories: string[], root = ''): BatchPreview => {
  fixtureState.batchSequence += 1
  const batch: BatchPreview = {
    batchId: `fixture-batch-${String(fixtureState.batchSequence)}`,
    entries: [],
  }
  appendFixtureDirectories(batch, directories, root)
  fixtureState.batches.set(batch.batchId, batch)
  return clone(batch)
}
