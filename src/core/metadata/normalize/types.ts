import type { Metadata } from '../metadata.js'

export type MetadataNormalizePlugin = (init: {
  cover?: Buffer
}) => (context: { metadata: Metadata; index: number }) => void | Promise<void>
