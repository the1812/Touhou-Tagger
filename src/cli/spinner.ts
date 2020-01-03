import { Ora } from 'ora'

export let spinner: Ora
export const resetSpinner = async () => {
  const ora = await import('ora')
  spinner = ora({
    text: '搜索中',
    spinner: {
      interval: 500,
      frames: ['.  ', '.. ', '...']
    }
  }).start()
}
