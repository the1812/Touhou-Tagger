import type { Metadata } from '../metadata'

export type MetadataNormalizePlugin = (init: {
  cover?: Buffer
}) => (context: { metadata: Metadata; index: number }) => void | Promise<void>
