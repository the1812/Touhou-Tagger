import { AlbumOptions, getAlbumOptions } from './album-options.js'
import { getCliOptions, type CliOptions } from './options.js'

export abstract class CliCommandBase {
  workingDir = '.'
  options: AlbumOptions & CliOptions
  constructor() {
    this.options = getCliOptions()
  }
  protected async loadAlbumOptions() {
    const albumOptions = await getAlbumOptions(this.workingDir, getCliOptions())
    Object.assign(this.options, albumOptions)
  }
}
