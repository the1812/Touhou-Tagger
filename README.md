# Touhou Tagger
从 [THBWiki](http://thwiki.cc/首页) 自动填写东方Project CD曲目信息.

支持的曲目信息包括:
- 标题
- 作者 (Vocal + 编曲者, 原创曲时为作曲者)
- 曲目编号
- 光盘编号
- 作曲者 (通常是原创曲时出现)
- 注释 (原曲信息)
- 作词者
- 专辑名称
- 专辑排序 (使用专辑编号)
- 专辑作者 (通常为社团名称)
- 流派
- 歌词
- 发布年份
- 封面图片

## 安装
需要事先装有 [Node.js](https://nodejs.org/en/)
然后使用以下命令来安装此工具:
```powershell
yarn global add touhou-tagger
```
没有 [yarn](https://yarnpkg.com/getting-started/install) 的话也可以用
```powershell
npm install -g touhou-tagger
```
## 使用
假设您为一个专辑的音乐建立了单独的文件夹, 在专辑文件夹中运行:
```powershell
thtag
```
启动后会询问专辑名称, 如果留空直接回车就取文件夹的名字; 如果按照这个名称没有**精确匹配**的专辑(**精确匹配**在 THBWiki 中表现为输入到搜索框回车能直接跳转到词条), 则会列出以此名称在 THBWiki 中的搜索结果, 可以继续选择一项作为专辑信息. (有精确匹配的话会直接开始下载专辑信息)

<details><summary><strong>图片示例</strong></summary>
<div>
  <img src="./before-files.jpg" alt="example" width="800">
</div>
<div>
  <img src="./before.jpg" alt="example" width="400">
</div>
<div>
  <img src="./after-files.jpg" alt="example" width="800">
</div>
<div>
  <img src="./after.jpg" alt="example" width="400">
</div>
</details>

## 选项
### 保存封面为单独的文件
(文件名为 `cover`, 类型取决于 THBWiki 上的资源)
```powershell
thtag -c
```
或
```powershell
thtag --cover
```
### 更换数据源
(默认为 `thb-wiki`)
```powershell
thtag -s xxx
```
或
```powershell
thtag --source xxx
```
### 下载歌词
#### 选项说明
- `-l` / `--lyric`: 启用歌词下载
- `-t` / `--lyric-type`: 歌词类型
  - **`original`(默认)**: 原版歌词
  - `translated`: 译文歌词, 没有译文时会回退到原版歌词
  - `mixed`: 混合原文和译文的歌词, 没有译文时同原版歌词
- `-o` / `--lyric-output`: 歌词输出
  - **`metadata`(默认)**: 写入到元数据中
  - `lrc`: 创建额外的`.lrc`歌词文件 (**⚠此功能尚未完善**)
- `-L` / `--no-lyric-time`: 禁用元数据歌词时轴

#### 示例
启用歌词下载, 写入原版歌词到元数据中
```powershell
thtag -l
```
启用歌词下载, 写入混合原文和译文的歌词到元数据中
```powershell
thtag -l -t mixed
```

## 魔改示例
(需要已安装 `Node.js` 及 `Typescript`)
### 安装依赖项
```powershell
yarn
```
或者
```powershell
npm install
```
### 添加其他数据源
在`src/core/metadata/`中添加文件`xxx.ts`, 继承`MetadataSource`类:
```TypeScript
import { MetadataSource } from './metadata-source'
import { Metadata } from './metadata'

export class XXX extends MetadataSource {
  // 搜索专辑, 返回 string 表示精确匹配, 返回 string[] 表示未找到精确匹配, 内容是根据 albumName 搜索得到的结果
  async resolveAlbumName(albumName: string): Promise<string[] | string> { /* ... */ }
  // 下载专辑信息, 返回 Metadata[]
  async getMetadata(albumName: string): Promise<Metadata[]> { /* ... */ }
}
export const xxx = new XXX()
```
然后在`src/core/metadata/source-mappings.ts`中添加对应项:
```TypeScript
import { thbWiki } from './thb-wiki';
import { xxx } from './xxx';
import { MetadataSource } from './metadata-source';

export const sourceMappings = {
  'thb-wiki': thbWiki,
  'xxx': xxx,
} as { [type: string]: MetadataSource }
```

### 添加其他文件类型支持
在`src/core/writer/`中添加文件`xxx-writer.ts`, 继承`MetadataWriter`类:
```TypeScript
import { MetadataWriter } from './metadata-writer'
import { Metadata } from './metadata'

export class XxxWriter extends MetadataWriter {
  // 将专辑信息写入文件
  async write(metadata: Metadata, filePath: string): Promise<void> { /* ... */ }
}
export const xxxWriter = new XxxWriter()
```
然后在`src/core/writer/writer-mappings.ts`中添加对应项:
```TypeScript
import { MetadataWriter } from './metadata-writer'
import { mp3Writer } from './mp3-writer'
import { xxxWriter } from './xxx-writer'

export const writerMappings = {
  '.mp3': mp3Writer,
  '.xxx': xxxWriter,
} as { [type: string]: MetadataWriter }
```

<!--
### 导出API
若需要导出API, 可在`src/core/index.ts`中添加相应导出:
```TypeScript
export * from './writer/metadata-writer'
export * from './writer/mp3-writer'
export * from './writer/writer-mappings'
export * from './metadata/metadata'
export * from './metadata/metadata-source'
export * from './metadata/source-mappings'
export * from './metadata/thb-wiki'

export * from './writer/xxx-writer'
export * from './metadata/xxx'
```
-->

### 编译
```powershell
tsc
```
