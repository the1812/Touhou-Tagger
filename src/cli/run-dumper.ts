import { CliDumper } from './dumper'
import { getCliOptions } from './options'

export const dump = async () => {
  const cliOptions = getCliOptions()
  if (cliOptions.batch) {
    import('./batch').then(({ runBatchDump }) => {
      runBatchDump(cliOptions.batch, cliOptions.batchDepth)
    })
  } else {
    await new CliDumper().run()
  }
}
