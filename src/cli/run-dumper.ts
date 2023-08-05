import { CliDumper } from './dumper'
import { cliOptions } from './options'

export const dump = async () => {
  if (cliOptions.batch) {
    import('./batch').then(({ runBatchDump }) => {
      runBatchDump(cliOptions.batch, cliOptions.batchDepth)
    })
  } else {
    await new CliDumper(cliOptions).run()
  }
}
