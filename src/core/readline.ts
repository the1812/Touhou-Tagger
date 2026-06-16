import rl from 'readline'

export const readline = (question: string) => {
  return new Promise<string>(resolve => {
    const reader = rl.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    reader.question(question, (answer: string) => {
      resolve(answer)
      reader.close()
    })
    reader.once('close', () => resolve(''))
  })
}
