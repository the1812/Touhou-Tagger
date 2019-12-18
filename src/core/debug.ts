let debug = false
export const setDebug = (value: boolean) => {
  debug = value
}
const invoke = (methodName: string) => {
  return (...args: any[]) => {
    if (!debug) {
      return
    }
    console[methodName](...args)
  }
}

export const log = invoke('log')
export const warn = invoke('warn')
export const error = invoke('error')