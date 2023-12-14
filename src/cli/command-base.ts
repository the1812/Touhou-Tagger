import { AlbumOptions, getAlbumOptions } from './album-options'
import { getCliOptions, type CliOptions } from './options'

export abstract class CliCommandBase {
  workingDir = '.'
  options: AlbumOptions & CliOptions
  constructor() {
    this.options = getCliOptions()
  }
  protected async loadAlbumOptions() {
    const albumOptions = await getAlbumOptions(this.workingDir)
    Object.assign(this.options, albumOptions)
  }
}
