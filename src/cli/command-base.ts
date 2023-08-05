import type { CliOptions } from './options'

export abstract class CliCommandBase {
  workingDir = '.'
  constructor(public cliOptions: CliOptions) {}
}
