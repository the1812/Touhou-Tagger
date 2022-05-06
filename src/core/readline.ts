import rl from 'readline'

const reader = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
})
export const readline = (question: string) => {
  return new Promise<string>(resolve => {
    reader.question(question, (answer: string) => resolve(answer))
  })
}
