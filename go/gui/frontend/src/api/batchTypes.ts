import type { AlbumCandidate, OperationResult, StateIssue } from './types'

export type BatchJobStatus =
  | 'loading'
  | 'ready'
  | 'needs-candidate'
  | 'local-metadata'
  | 'blocked'
  | 'scan-failed'
  | 'no-audio'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface BatchJobPreview {
  canRun: boolean
  id: string
  relativePath: string
  inferredAlbumName: string
  source: string
  matchDescription: string
  audioCount: number
  status: BatchJobStatus
  issues: StateIssue[]
  candidates: AlbumCandidate[]
  selectedCandidateId?: string
}

export interface BatchPreview {
  batchId: string
  rootDirectory: string
  depth: number
  jobs: BatchJobPreview[]
}

export interface BatchRunResult extends OperationResult {
  jobs: BatchJobPreview[]
}
