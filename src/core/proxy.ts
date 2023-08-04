export const defaultsToEmptyString = <T extends object>(obj: T) => {
  return new Proxy<T>(obj, {
    get(target, prop, ...args) {
      if (prop in target) {
        return Reflect.get(target, prop, ...args)
      }
      return ''
    },
  })
}
