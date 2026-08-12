import {
  Check,
  ExternalLink,
  FileAudio,
  FileCog,
  FileJson,
  FolderOpen,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, defineComponent, reactive, ref, watch } from 'vue'

import type { AlbumCandidate, PlanItemPreview, TrackMetadataPatch } from '../../api'
import { useSettingsStore } from '../../stores/settings'
import { useWorkspaceStore } from '../../stores/workspace'
import { CoverPreview } from './CoverPreview'
import { MetadataTagsInput } from './MetadataTagsInput'
import { OperationPanel } from './OperationPanel'
import { PlanTable } from './PlanTable'
import { TrackMetadataDialog } from './TrackMetadataDialog'

const workspaceCardClass =
  'min-w-0 max-w-full border-b border-surface-200 py-5 dark:border-surface-700'
const cardHeadingClass = 'flex items-start justify-between gap-6'
const metadataFieldClass =
  'grid gap-1.5 text-[.82rem] font-semibold [&>small]:text-xs [&>small]:font-normal'

export const TaggingPage = defineComponent({
  name: 'TaggingPage',
  setup() {
    const workspace = useWorkspaceStore()
    const settings = useSettingsStore()
    const {
      phase,
      summary,
      query,
      source,
      candidates,
      hasSearched,
      selectedCandidateId,
      plan,
      operation,
      result,
      isBusy,
      blockingIssues,
      canSearch,
      canPrepare,
      canCommit,
    } = storeToRefs(workspace)
    const selectedTrack = ref<PlanItemPreview>()
    const trackDialogVisible = ref(false)
    const albumDialogVisible = ref(false)
    const albumDraft = reactive({
      title: '',
      albumOrder: '',
      artists: [] as string[],
      year: '',
      genres: [] as string[],
    })
    const sourceOptions = computed(
      () =>
        settings.capabilities?.sources.filter(option => option.supportsSearch) ?? [
          { value: 'thb-wiki', label: 'THBWiki', supportsSearch: true },
        ],
    )
    const selectedSource = computed({
      get: () => source.value,
      set: (value: string) => workspace.changeSource(value),
    })
    watch(
      () => plan.value?.album,
      album => {
        if (!album) {
          return
        }
        albumDraft.title = album.title
        albumDraft.albumOrder = album.albumOrder
        albumDraft.artists = [...album.artists]
        albumDraft.year = album.year
        albumDraft.genres = [...album.genres]
      },
      { immediate: true },
    )

    if (!settings.capabilities) {
      settings.load()
    }

    const chooseCandidate = (candidate: AlbumCandidate) => {
      workspace.selectCandidate(candidate.id)
    }
    const openTrack = (item: PlanItemPreview) => {
      if (isBusy.value) {
        return
      }
      selectedTrack.value = item
      trackDialogVisible.value = true
    }
    const saveTrack = (patch: TrackMetadataPatch) => {
      workspace.updateTrack(patch)
    }
    const saveAlbum = () => {
      workspace.updateAlbum({
        title: albumDraft.title.trim(),
        albumOrder: albumDraft.albumOrder.trim(),
        artists: albumDraft.artists,
        year: albumDraft.year.trim(),
        genres: albumDraft.genres,
      })
      albumDialogVisible.value = false
    }
    const prepareLocalMetadata = () => {
      workspace.selectCandidate('local-json')
      workspace.preparePlan('local-json')
    }
    return () => {
      const currentSummary = summary.value
      const currentPlan = plan.value
      const currentOperation = operation.value
      const currentResult = result.value
      const currentPhase = phase.value
      const showsSearch = Boolean(
        currentSummary &&
        currentPhase !== 'failed' &&
        !currentSummary.hasMetadataJson &&
        !currentPlan &&
        !currentOperation &&
        !currentResult,
      )

      return (
        <div
          class={[
            'round-icon-buttons grid min-h-full content-start gap-0 pb-[4.5rem]',
            {
              '-mx-6 -my-5 h-[calc(100%+2.5rem)] min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden':
                showsSearch,
            },
          ]}
        >
          {currentPhase === 'idle' || currentPhase === 'selecting' ? (
            <section class="grid min-h-[calc(100vh-190px)] place-items-center content-center gap-4 text-center">
              <Button
                class="h-[38px] min-h-[38px] w-48 [&_.p-button-icon]:size-[19px] [&_.p-button-icon]:shrink-0 [&_.p-button-loading-icon]:size-[19px] [&_.p-button-loading-icon]:shrink-0 [&>svg]:size-[19px] [&>svg]:shrink-0"
                label="选择专辑文件夹"
                size="large"
                loading={currentPhase === 'selecting'}
                onClick={() => workspace.selectDirectory()}
              >
                {{ icon: () => <FolderOpen size={19} /> }}
              </Button>
              <span class="text-[.78rem] text-surface-500 dark:text-surface-400">
                <kbd class="app-kbd">
                  Ctrl
                </kbd>{' '}
                +{' '}
                <kbd class="app-kbd">
                  O
                </kbd>
              </span>
            </section>
          ) : (
            <>
              <div
                class={['min-w-0 -mt-5', { 'mt-0 block min-h-0 overflow-auto px-6': showsSearch }]}
              >
                <section class={workspaceCardClass}>
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
                        <div class={cardHeadingClass}>
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
                            文件状态可能已经变化，原写入预览已失效。请重新扫描当前目录后再继续。
                          </Message>
                        )}
                      </>
                    )
                  )}
                </section>

                {currentSummary &&
                  currentPhase !== 'failed' &&
                  !currentSummary.hasMetadataJson &&
                  !currentPlan &&
                  !currentOperation &&
                  !currentResult && (
                    <section class={`${workspaceCardClass} border-b-0`}>
                      <div class={cardHeadingClass}>
                        <div>
                          <h2 class="mt-1 text-[1.18rem] font-bold">搜索专辑</h2>
                        </div>
                      </div>

                      <form
                        class="mt-4 grid grid-cols-[12rem_minmax(12rem,1fr)_auto] gap-3"
                        onSubmit={event => {
                          event.preventDefault()
                          workspace.search()
                        }}
                      >
                        <Select
                          v-model={selectedSource.value}
                          options={sourceOptions.value}
                          optionLabel="label"
                          optionValue="value"
                          disabled={isBusy.value}
                        />
                        <InputText
                          id="album-search"
                          v-model={query.value}
                          placeholder="输入专辑名称"
                          autocomplete="off"
                          fluid
                          disabled={isBusy.value}
                        />
                        <Button
                          label="搜索"
                          type="submit"
                          loading={currentPhase === 'searching'}
                          disabled={!canSearch.value}
                        >
                          {{ icon: () => <Search size={17} /> }}
                        </Button>
                      </form>

                      {currentPhase === 'searching' ? (
                        <div class="mt-4 grid gap-2">
                          {[1, 2, 3].map(index => (
                            <Skeleton key={index} height="3.25rem" />
                          ))}
                        </div>
                      ) : candidates.value.length ? (
                        <div class="mt-4 grid gap-0 border-t border-surface-200 dark:border-surface-700">
                          {candidates.value.map(candidate => (
                            <button
                              key={candidate.id}
                              type="button"
                              class="candidate-option"
                              data-selected={selectedCandidateId.value === candidate.id}
                              disabled={isBusy.value}
                              onClick={() => chooseCandidate(candidate)}
                            >
                              <span
                                class={[
                                  'grid size-5 place-items-center rounded-full border border-surface-300 text-white dark:border-surface-600',
                                  {
                                    'border-primary bg-primary':
                                      selectedCandidateId.value === candidate.id,
                                  },
                                ]}
                              >
                                {selectedCandidateId.value === candidate.id && <Check size={15} />}
                              </span>
                              <strong class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                                {candidate.title}
                              </strong>
                            </button>
                          ))}
                        </div>
                      ) : hasSearched.value ? (
                        <div class="mt-4 grid place-items-center gap-1.5 border-y border-surface-200 py-5 text-center text-muted-color dark:border-surface-700">
                          <Search size={30} />
                          <strong>没有找到候选</strong>
                        </div>
                      ) : null}
                    </section>
                  )}

                {currentSummary?.hasMetadataJson &&
                  currentPhase !== 'failed' &&
                  !currentPlan &&
                  !currentOperation &&
                  !currentResult && (
                    <section
                      class={`${workspaceCardClass} flex items-center justify-between gap-4`}
                    >
                      <div class="flex items-center gap-4">
                        <FileJson class="text-primary" size={30} />
                        <h2 class="m-0 font-bold">使用本地 metadata.json</h2>
                      </div>
                      <Button
                        label="预览本地元数据"
                        loading={currentPhase === 'preparing'}
                        onClick={prepareLocalMetadata}
                      />
                    </section>
                  )}

                {currentPlan && !currentOperation && !currentResult && (
                  <>
                    <section
                      class={`${workspaceCardClass} grid w-full grid-cols-[188px_minmax(300px,1fr)] gap-4 max-[1100px]:grid-cols-1`}
                    >
                      <div class="grid w-[188px] content-start gap-3">
                        <CoverPreview cover={currentPlan.cover} />
                        {currentPlan.options.canSaveCover && (
                          <label class="flex items-center justify-center gap-3 [&>strong]:text-sm">
                            <ToggleSwitch
                              modelValue={currentPlan.options.saveCover}
                              {...{
                                'onUpdate:modelValue': (value: boolean) =>
                                  workspace.updateSaveCover(value),
                              }}
                              disabled={isBusy.value}
                            />
                            <strong>
                              {currentSummary?.localCover.exists ? '覆盖本地封面' : '另存原始封面'}
                            </strong>
                          </label>
                        )}
                      </div>
                      <div class="grid content-start gap-4">
                        <div class={cardHeadingClass}>
                          <div>
                            <h2 class="mt-1 text-[1.18rem] font-bold">
                              {currentPlan.album.title}
                            </h2>
                          </div>
                          <Button
                            label="编辑专辑信息"
                            severity="secondary"
                            outlined
                            disabled={isBusy.value}
                            onClick={() => {
                              albumDialogVisible.value = true
                            }}
                          >
                            {{ icon: () => <Pencil size={16} /> }}
                          </Button>
                        </div>
                        <div class="grid gap-2 [&>span]:grid [&>span]:grid-cols-[4rem_minmax(0,1fr)] [&>span]:text-sm [&>span]:text-muted-color [&_strong]:text-color">
                          <span>
                            <strong>社团</strong>
                            {currentPlan.album.artists.join(' / ') || '—'}
                          </span>
                          <span>
                            <strong>年份</strong>
                            {currentPlan.album.year || '—'}
                          </span>
                          <span>
                            <strong>编号</strong>
                            {currentPlan.album.albumOrder || '—'}
                          </span>
                          <span>
                            <strong>风格</strong>
                            {currentPlan.album.genres.join(' / ') || '—'}
                          </span>
                          <span>
                            <strong>来源</strong>
                            {currentPlan.candidate.sourceLabel}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section
                      class={`${workspaceCardClass} grid min-h-[380px] w-full gap-4 border-b-0`}
                    >
                      <h2 class="m-0 text-base font-bold">
                        {currentPlan.items.length} 首曲目
                      </h2>
                      {currentPlan.issues.map(issue => (
                        <Message
                          key={issue.code}
                          severity={issue.severity === 'error' ? 'error' : 'warn'}
                          closable={false}
                        >
                          {issue.message}
                        </Message>
                      ))}
                      <PlanTable
                        items={currentPlan.items}
                        disabled={isBusy.value}
                        onEdit={openTrack}
                      />
                    </section>

                    <div class="action-bar fixed right-0 bottom-0 left-[216px] justify-between backdrop-blur-md">
                      <div class="flex items-center gap-4 text-[.85rem] text-muted-color [&_strong]:text-color">
                        <span>
                          将写入 <strong>{currentPlan.options.writeFiles}</strong> 个文件
                          {currentPlan.options.saveCover &&
                            (currentSummary?.localCover.exists
                              ? '，覆盖本地封面'
                              : '，另存原始封面')}
                        </span>
                      </div>
                      <div class="flex items-center gap-4">
                        <Button
                          label="上一步"
                          severity="secondary"
                          text
                          disabled={isBusy.value}
                          onClick={() => workspace.backToSearch()}
                        />
                        <span
                          class="inline-flex"
                          v-tooltip={{
                            value: blockingIssues.value.length
                              ? `${blockingIssues.value.length} 个阻塞问题需要修复`
                              : '可以开始写入',
                            disabled: blockingIssues.value.length === 0,
                          }}
                        >
                          <Button
                            label={`写入 ${currentPlan.options.writeFiles} 首`}
                            size="large"
                            disabled={!canCommit.value}
                            onClick={() => workspace.commit()}
                          />
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {currentOperation && (
                  <OperationPanel
                    operation={currentOperation}
                    onCancel={() => workspace.cancel()}
                  />
                )}

                {currentResult && (
                  <section
                    class={`${workspaceCardClass} grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b-0 py-6`}
                  >
                    <div class="grid size-16 place-items-center rounded-full bg-surface-100 text-primary dark:bg-primary-950">
                      <Check size={34} />
                    </div>
                    <div>
                      <h2 class="mt-1.5 text-[1.35rem] font-bold">
                        已完成写入 {currentResult.succeeded} 首曲目
                      </h2>
                      <p class="mt-2.5 text-[.8rem] text-muted-color">
                        耗时 {(currentResult.durationMs / 1000).toFixed(1)}s
                      </p>
                      <div class="mt-5 flex gap-3">
                        <Button
                          label="在资源管理器中打开"
                          severity="secondary"
                          outlined
                          onClick={() => workspace.reveal()}
                        >
                          {{ icon: () => <ExternalLink size={17} /> }}
                        </Button>
                        <Button label="处理另一张专辑" onClick={() => workspace.startOver()} />
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {showsSearch && candidates.value.length > 0 && (
                <div class="action-bar fixed right-0 bottom-0 left-[216px] justify-end backdrop-blur-lg">
                  <Button
                    label="下一步"
                    size="large"
                    disabled={!canPrepare.value}
                    loading={currentPhase === 'preparing'}
                    onClick={() => workspace.preparePlan()}
                  />
                </div>
              )}
            </>
          )}

          <TrackMetadataDialog
            visible={trackDialogVisible.value}
            {...{
              'onUpdate:visible': (value: boolean) => {
                trackDialogVisible.value = value
              },
            }}
            item={selectedTrack.value}
            onSave={saveTrack}
          />

          <Dialog
            v-model:visible={albumDialogVisible.value}
            modal
            header="编辑专辑信息"
            class="w-[min(560px,calc(100vw-2rem))]"
          >
            {{
              default: () => (
                <div class="grid gap-3.5">
                  <label class={metadataFieldClass}>
                    <span>专辑名称</span>
                    <InputText
                      v-model={albumDraft.title}
                      fluid
                      invalid={!albumDraft.title.trim()}
                    />
                  </label>
                  <div class="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                    <label class={metadataFieldClass}>
                      <span>发行编号</span>
                      <InputText v-model={albumDraft.albumOrder} fluid />
                    </label>
                    <label class={metadataFieldClass}>
                      <span>年份</span>
                      <InputText v-model={albumDraft.year} fluid />
                    </label>
                  </div>
                  <label class={metadataFieldClass}>
                    <span>社团</span>
                    <MetadataTagsInput
                      modelValue={albumDraft.artists}
                      {...{
                        'onUpdate:modelValue': (values: string[]) => {
                          albumDraft.artists = values
                        },
                      }}
                    />
                  </label>
                  <label class={metadataFieldClass}>
                    <span>风格</span>
                    <MetadataTagsInput
                      modelValue={albumDraft.genres}
                      {...{
                        'onUpdate:modelValue': (values: string[]) => {
                          albumDraft.genres = values
                        },
                      }}
                    />
                  </label>
                </div>
              ),
              footer: () => (
                <>
                  <Button
                    label="取消"
                    severity="secondary"
                    text
                    onClick={() => {
                      albumDialogVisible.value = false
                    }}
                  />
                  <Button label="保存" disabled={!albumDraft.title.trim()} onClick={saveAlbum} />
                </>
              ),
            }}
          </Dialog>
        </div>
      )
    }
  },
})
