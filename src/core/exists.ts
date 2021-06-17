export const resolvePath = async (path: string) => {
  const { resolve } = await import('path')
  const { existsSync } = await import('fs')
  const localSourcePath = resolve(path).replace(/\\/g, '/')
  if (!existsSync(localSourcePath)) {
    throw new Error('路径不存在')
  }
  return localSourcePath
}
