import { spinner } from './spinner'
import { downloadMetadata } from './download-metadata'
import { createFiles } from './create-files'
import { writeMetadata } from './write-metadata'

export const fetchMetadata = async (album: string) => {
  spinner.start(`下载专辑信息中: ${album}`)
  const metadata = await downloadMetadata(album)
  spinner.text = '创建文件中'
  const targetFiles = await createFiles(metadata)
  spinner.text = '写入专辑信息中'
  await writeMetadata(metadata, targetFiles)
  spinner.succeed(`成功写入了专辑信息: ${album}`)
  process.exit()
}