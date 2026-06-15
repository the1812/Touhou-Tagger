import { CliDumper } from './dumper.js'
import { getCliOptions } from './options.js'

export const dump = async () => {
  const cliOptions = getCliOptions()
  if (cliOptions.batch) {
    const { runBatchDump } = await import('./batch.js')
    await runBatchDump(cliOptions.batch, cliOptions.batchDepth)
  } else {
    await new CliDumper().run()
  }
}
