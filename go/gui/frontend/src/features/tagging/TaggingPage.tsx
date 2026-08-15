import {
  ExternalLink,
  FileAudio,
  FileCog,
  FileJson,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

import { usePageCommands } from '../../app/pageCommands'
import { CompletionPanel } from '../../shared/CompletionPanel'
import { OperationPanel } from '../../shared/OperationPanel'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaggingPlanStep } from './TaggingPlanStep'
import { TaggingSearchStep } from './TaggingSearchStep'

export const TaggingPage = defineComponent({
  name: 'TaggingPage',
  setup() {
    const workspace = useWorkspaceStore()
    const { phase, summary, operation, result, isBusy } = storeToRefs(workspace)

    usePageCommands({
      openDirectory: () => workspace.selectDirectory(),
      refresh: () => {
        if (!summary.value?.directory) {
          return false
        }
        workspace.scan()
        return true
      },
      focusSearch: () => {
        const input = document.querySelector<HTMLInputElement>('#album-search')
        if (!input) {
          return false
        }
        input.focus()
        return true
      },
    })

    return () => {
      const currentSummary = summary.value
      const currentOperation = operation.value
      const currentResult = result.value
      const currentPhase = phase.value

      return (
        <div class="round-icon-buttons grid min-h-full content-start gap-0">
          {currentPhase === 'idle' || currentPhase === 'selecting' ? (
            <section class="page-empty-state">
              <Button
                class="directory-picker-button"
                label="选择目录"
                size="large"
                loading={currentPhase === 'selecting'}
                onClick={() => workspace.selectDirectory()}
              >
                {{ icon: () => <FolderOpen size={19} /> }}
              </Button>
              <span class="text-[.78rem] text-surface-500 dark:text-surface-400">
                <kbd class="app-kbd">Ctrl</kbd> + <kbd class="app-kbd">O</kbd>
              </span>
            </section>
          ) : (
            <div class="min-w-0 -mt-5">
              <section class="workspace-section">
                {currentPhase === 'scanning' ? (
                  <div class="grid gap-3">
                    <Skeleton width="55%" height="1.4rem" />
                    <Skeleton width="80%" height="0.8rem" />
                    <div class="mt-2 flex gap-3">
                      {[1, 2, 3, 4].map(index => (
                        <Skeleton key={index} width="7rem" height="3.4rem" />
                      ))}
                    </div>
                  </div>
                ) : (
                  currentSummary && (
                    <>
                      <div class="workspace-heading">
                        <div>
                          <h2 class="mt-1 text-[1.18rem] font-bold">
                            {currentSummary.inferredAlbumName || '未命名专辑'}
                          </h2>
                          <p
                            class="mt-1.5 max-w-[min(760px,65vw)] overflow-hidden text-ellipsis whitespace-nowrap text-[.82rem] text-muted-color"
                            title={currentSummary.directory}
                          >
                            {currentSummary.directory}
                          </p>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <Button
                            title="在资源管理器中打开"
                            severity="secondary"
                            text
                            rounded
                            onClick={() => workspace.reveal()}
                          >
                            {{ icon: () => <ExternalLink size={17} /> }}
                          </Button>
                          <Button
                            title="重新扫描 (F5)"
                            severity="secondary"
                            text
                            rounded
                            disabled={isBusy.value}
                            onClick={() => workspace.scan()}
                          >
                            {{ icon: () => <RefreshCw size={17} /> }}
                          </Button>
                          <Button
                            label="更换目录"
                            severity="secondary"
                            outlined
                            disabled={isBusy.value}
                            onClick={() => workspace.selectDirectory()}
                          >
                            {{ icon: () => <FolderOpen size={17} /> }}
                          </Button>
                        </div>
                      </div>

                      <div class="mt-3 flex w-max max-w-full items-center gap-0.5">
                        <div
                          class="status-icon w-auto gap-1.5 py-0 pl-1 pr-2 text-primary [&>strong]:text-[.82rem] [&>strong]:tabular-nums"
                          v-tooltip={`${currentSummary.audioCount} 首音频（${currentSummary.mp3Count} MP3 · ${currentSummary.flacCount} FLAC）`}
                        >
                          <FileAudio size={19} />
                          <strong>{currentSummary.audioCount}</strong>
                        </div>
                        <div
                          class={[
                            'status-icon w-8',
                            { 'text-primary!': currentSummary.localCover.exists },
                          ]}
                          v-tooltip={
                            currentSummary.localCover.issue?.message ||
                            (currentSummary.localCover.exists
                              ? `本地封面：${currentSummary.localCover.fileName || '已找到'}`
                              : '没有本地封面，可使用数据源封面')
                          }
                        >
                          <ImageIcon size={19} />
                        </div>
                        <div
                          class={[
                            'status-icon w-8',
                            { 'text-primary!': currentSummary.hasMetadataJson },
                          ]}
                          v-tooltip={
                            currentSummary.hasMetadataJson
                              ? '已有 metadata.json，将跳过在线搜索'
                              : '没有 metadata.json，需要匹配元数据'
                          }
                        >
                          <FileJson size={19} />
                        </div>
                        <div
                          class={[
                            'status-icon w-8',
                            { 'text-primary!': currentSummary.hasAlbumConfig },
                          ]}
                          v-tooltip={
                            currentSummary.hasAlbumConfig
                              ? '已有 thtag.json，将应用专辑级配置'
                              : '没有 thtag.json，使用全局设置'
                          }
                        >
                          <FileCog size={19} />
                        </div>
                      </div>

                      {currentSummary.issues
                        .filter(item => item.code !== currentSummary.localCover.issue?.code)
                        .map(issue => (
                          <Message
                            key={issue.code}
                            severity={issue.severity === 'error' ? 'error' : 'warn'}
                            closable={false}
                          >
                            {issue.message}
                          </Message>
                        ))}

                      {currentPhase === 'failed' && (
                        <Message severity="warn" closable={false}>
                          文件状态可能已经变化，原写入内容已失效。请重新扫描当前目录后再继续。
                        </Message>
                      )}
                    </>
                  )
                )}
              </section>

              <TaggingSearchStep />
              <TaggingPlanStep />

              {currentOperation && (
                <OperationPanel operation={currentOperation} onCancel={() => workspace.cancel()} />
              )}
              {currentResult && (
                <CompletionPanel
                  onReveal={() => workspace.reveal()}
                  onComplete={() => workspace.startOver()}
                />
              )}
            </div>
          )}
        </div>
      )
    }
  },
})
