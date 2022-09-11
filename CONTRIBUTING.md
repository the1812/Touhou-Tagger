# 代码贡献指南
需要已安装 `Node.js`, `pnpm` 及 `Typescript`

## 安装依赖项
```powershell
pnpm install
```

## 添加其他数据源
在 `src/core/metadata/` 中添加文件 `xxx.ts`, 继承 `MetadataSource` 类:
```TypeScript
import { MetadataSource } from './metadata-source'
import { Metadata } from './metadata'

export class XXX extends MetadataSource {
  // 搜索专辑, 返回 string 表示精确匹配, 返回 string[] 表示未找到精确匹配, 内容是根据 albumName 搜索得到的结果
  async resolveAlbumName(albumName: string): Promise<string[] | string> { /* ... */ }
  // 下载专辑信息, 返回 Metadata[], cover 如果传入现成的封面图片 Buffer, 将跳过封面下载节省时间
  async getMetadata(albumName: string, cover?: Buffer): Promise<Metadata[]> { /* ... */ }
}
export const xxx = new XXX()
```
然后在 `src/core/metadata/source-mappings.ts` 中添加对应项:
```TypeScript
import { thbWiki } from './thb-wiki';
import { xxx } from './xxx';
import { MetadataSource } from './metadata-source';

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'xxx': xxx,
} as { [type: string]: MetadataSource }
```

## 添加其他文件类型支持
在 `src/core/writer/` 中添加文件 `xxx-writer.ts`, 继承 `MetadataWriter` 类:
```TypeScript
import { MetadataWriter } from './metadata-writer'
import { Metadata } from './metadata'

export class XxxWriter extends MetadataWriter {
  // 将专辑信息写入文件
  async write(metadata: Metadata, filePath: string): Promise<void> { /* ... */ }
}
export const xxxWriter = new XxxWriter()
```
然后在 `src/core/writer/writer-mappings.ts` 中添加对应项:
```TypeScript
import { MetadataWriter } from './metadata-writer'
import { mp3Writer } from './mp3-writer'
import { xxxWriter } from './xxx-writer'

export const writerMappings = {
  '.mp3': mp3Writer,
  '.xxx': xxxWriter,
} as { [type: string]: MetadataWriter }
```

## 编译
```powershell
pnpm watch
```

## 本地版本

安装:
```powershell
pnpm link --global
```

卸载:
```powershell
pnpm remove --global touhou-tagger
```
