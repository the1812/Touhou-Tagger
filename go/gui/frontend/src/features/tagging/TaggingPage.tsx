import { computed, defineComponent, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
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

import type { AlbumCandidate, PlanItemPreview, TrackMetadataPatch } from '../../api'
import { useSettingsStore } from '../../stores/settings'
import { useWorkspaceStore } from '../../stores/workspace'
import { CoverPreview } from './CoverPreview'
import { MetadataTagsInput } from './MetadataTagsInput'
import { TrackMetadataDialog } from './TrackMetadataDialog'
import { OperationPanel } from './OperationPanel'
import { PlanTable } from './PlanTable'

import './TaggingPage.css'

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
      void settings.load()
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
      void workspace.updateTrack(patch)
    }
    const saveAlbum = () => {
      void workspace.updateAlbum({
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
      void workspace.preparePlan('local-json')
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
        <div class={['tagging-page', { 'tagging-page--search': showsSearch }]}>
          {currentPhase === 'idle' || currentPhase === 'selecting' ? (
            <section class="empty-workspace">
              <Button
                class="empty-workspace__button"
                label="选择专辑文件夹"
                size="large"
                loading={currentPhase === 'selecting'}
                onClick={() => void workspace.selectDirectory()}
              >
                {{ icon: () => <FolderOpen size={19} /> }}
              </Button>
              <span class="keyboard-hint">
                <kbd>Ctrl</kbd> + <kbd>O</kbd>
              </span>
            </section>
          ) : (
            <>
              <div class="tagging-page__content">
              <section class="workspace-card directory-card">
                {currentPhase === 'scanning' ? (
                  <div class="directory-card__loading">
                    <Skeleton width="55%" height="1.4rem" />
                    <Skeleton width="80%" height="0.8rem" />
                    <div class="summary-skeletons">
                      {[1, 2, 3, 4].map(index => (
                        <Skeleton key={index} width="7rem" height="3.4rem" />
                      ))}
                    </div>
                  </div>
                ) : (
                  currentSummary && (
                    <>
                      <div class="card-heading">
                        <div>
                          <h2>{currentSummary.inferredAlbumName || '未命名专辑'}</h2>
                          <p class="path-text" title={currentSummary.directory}>
                            {currentSummary.directory}
                          </p>
                        </div>
                        <div class="heading-actions">
                          <Button
                            title="在资源管理器中打开"
                            aria-label="在资源管理器中打开"
                            severity="secondary"
                            text
                            rounded
                            onClick={() => void workspace.reveal()}
                          >
                            {{ icon: () => <ExternalLink size={17} /> }}
                          </Button>
                          <Button
                            title="重新扫描 (F5)"
                            aria-label="重新扫描"
                            severity="secondary"
                            text
                            rounded
                            disabled={isBusy.value}
                            onClick={() => void workspace.scan()}
                          >
                            {{ icon: () => <RefreshCw size={17} /> }}
                          </Button>
                          <Button
                            label="更换目录"
                            severity="secondary"
                            outlined
                            disabled={isBusy.value}
                            onClick={() => void workspace.selectDirectory()}
                          >
                            {{ icon: () => <FolderOpen size={17} /> }}
                          </Button>
                        </div>
                      </div>

                      <div class="directory-stats" aria-label="目录状态">
                        <div
                          class="directory-stat directory-stat--available directory-stat--audio"
                          tabindex={0}
                          aria-label={`${currentSummary.audioCount} 首音频，${currentSummary.mp3Count} 个 MP3，${currentSummary.flacCount} 个 FLAC`}
                          v-tooltip={`${currentSummary.audioCount} 首音频（${currentSummary.mp3Count} MP3 · ${currentSummary.flacCount} FLAC）`}
                        >
                          <FileAudio size={19} />
                          <strong>{currentSummary.audioCount}</strong>
                        </div>
                        <div
                          class={[
                            'directory-stat',
                            { 'directory-stat--available': currentSummary.localCover.exists },
                          ]}
                          tabindex={0}
                          aria-label={
                            currentSummary.localCover.issue?.message ||
                            (currentSummary.localCover.exists
                              ? `本地封面：${currentSummary.localCover.fileName || '已找到'}`
                              : '没有本地封面，可使用数据源封面')
                          }
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
                            'directory-stat',
                            { 'directory-stat--available': currentSummary.hasMetadataJson },
                          ]}
                          tabindex={0}
                          aria-label={
                            currentSummary.hasMetadataJson
                              ? '已有 metadata.json，将跳过在线搜索'
                              : '没有 metadata.json，需要匹配元数据'
                          }
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
                            'directory-stat',
                            { 'directory-stat--available': currentSummary.hasAlbumConfig },
                          ]}
                          tabindex={0}
                          aria-label={
                            currentSummary.hasAlbumConfig
                              ? '已有 thtag.json，将应用专辑级配置'
                              : '没有 thtag.json，使用全局设置'
                          }
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
                  <section class="workspace-card search-card">
                    <div class="card-heading">
                      <div>
                        <h2>搜索专辑</h2>
                      </div>
                    </div>

                    <form
                      class="album-search"
                      onSubmit={event => {
                        event.preventDefault()
                        void workspace.search()
                      }}
                    >
                      <Select
                        class="source-select"
                        v-model={selectedSource.value}
                        options={sourceOptions.value}
                        optionLabel="label"
                        optionValue="value"
                        overlayClass="source-select-overlay"
                        aria-label="数据源"
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
                      <div class="candidate-skeletons">
                        {[1, 2, 3].map(index => (
                          <Skeleton key={index} height="3.25rem" />
                        ))}
                      </div>
                    ) : candidates.value.length ? (
                      <div class="candidate-list" role="listbox" aria-label="专辑候选">
                        {candidates.value.map(candidate => (
                          <button
                            key={candidate.id}
                            type="button"
                            class={[
                              'candidate-card',
                              { 'candidate-card--selected': selectedCandidateId.value === candidate.id },
                            ]}
                            aria-selected={selectedCandidateId.value === candidate.id}
                            disabled={isBusy.value}
                            onClick={() => chooseCandidate(candidate)}
                          >
                            <span class="candidate-card__indicator">
                              {selectedCandidateId.value === candidate.id && <Check size={15} />}
                            </span>
                            <strong class="candidate-card__title">{candidate.title}</strong>
                          </button>
                        ))}
                      </div>
                    ) : hasSearched.value ? (
                      <div class="search-empty">
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
                  <section class="workspace-card local-metadata-card">
                    <div>
                      <FileJson size={30} />
                      <h2>使用本地 metadata.json</h2>
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
                  <section class="workspace-card plan-header">
                    <div class="plan-cover">
                      <CoverPreview cover={currentPlan.cover} />
                      {currentPlan.options.canSaveCover && (
                        <label class="cover-save-option">
                          <ToggleSwitch
                            modelValue={currentPlan.options.saveCover}
                            {...{
                              'onUpdate:modelValue': (value: boolean) =>
                                void workspace.updateSaveCover(value),
                            }}
                            disabled={isBusy.value}
                          />
                          <strong>
                            {currentSummary?.localCover.exists ? '覆盖本地封面' : '另存原始封面'}
                          </strong>
                        </label>
                      )}
                    </div>
                    <div class="plan-header__metadata">
                      <div class="card-heading">
                        <div>
                          <h2>{currentPlan.album.title}</h2>
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
                      <div class="album-facts">
                        <span><strong>社团</strong>{currentPlan.album.artists.join(' / ') || '—'}</span>
                        <span><strong>年份</strong>{currentPlan.album.year || '—'}</span>
                        <span><strong>编号</strong>{currentPlan.album.albumOrder || '—'}</span>
                        <span><strong>风格</strong>{currentPlan.album.genres.join(' / ') || '—'}</span>
                        <span><strong>来源</strong>{currentPlan.candidate.sourceLabel}</span>
                      </div>
                    </div>
                  </section>

                  <section class="workspace-card plan-items-card">
                    <h2>{currentPlan.items.length} 首曲目</h2>
                    {currentPlan.issues.map(issue => (
                      <Message
                        key={issue.code}
                        severity={issue.severity === 'error' ? 'error' : 'warn'}
                        closable={false}
                      >
                        {issue.message}
                      </Message>
                    ))}
                    <PlanTable items={currentPlan.items} disabled={isBusy.value} onEdit={openTrack} />
                  </section>

                  <div class="commit-bar">
                    <div class="commit-bar__summary">
                      <span>
                        将写入 <strong>{currentPlan.options.writeFiles}</strong> 个文件
                        {currentPlan.options.saveCover &&
                          (currentSummary?.localCover.exists
                            ? '，覆盖本地封面'
                            : '，另存原始封面')}
                      </span>
                    </div>
                    <div class="commit-bar__action">
                      <Button
                        label="上一步"
                        severity="secondary"
                        text
                        disabled={isBusy.value}
                        onClick={() => void workspace.backToSearch()}
                      />
                      <span
                        class="commit-bar__write"
                        tabindex={blockingIssues.value.length ? 0 : undefined}
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
                          onClick={() => void workspace.commit()}
                        />
                      </span>
                    </div>
                  </div>
                </>
              )}

              {currentOperation && (
                <OperationPanel
                  operation={currentOperation}
                  onCancel={() => void workspace.cancel()}
                />
              )}

              {currentResult && (
                <section class="workspace-card result-card">
                  <div class="result-card__icon"><Check size={34} /></div>
                  <div>
                    <h2>已完成写入 {currentResult.succeeded} 首曲目</h2>
                    <p class="result-duration">
                      耗时 {(currentResult.durationMs / 1000).toFixed(1)}s
                    </p>
                    <div class="result-actions">
                      <Button
                        label="在资源管理器中打开"
                        severity="secondary"
                        outlined
                        onClick={() => void workspace.reveal()}
                      >
                        {{ icon: () => <ExternalLink size={17} /> }}
                      </Button>
                      <Button label="处理另一张专辑" onClick={() => void workspace.startOver()} />
                    </div>
                  </div>
                </section>
              )}
              </div>

              {showsSearch && candidates.value.length > 0 && (
                <div class="search-action-bar">
                  <Button
                    label="下一步"
                    size="large"
                    disabled={!canPrepare.value}
                    loading={currentPhase === 'preparing'}
                    onClick={() => void workspace.preparePlan()}
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
            class="metadata-dialog"
            style={{ width: 'min(560px, calc(100vw - 2rem))' }}
          >
            {{
              default: () => (
                <div class="metadata-form">
                  <label>
                    <span>专辑名称</span>
                    <InputText v-model={albumDraft.title} fluid invalid={!albumDraft.title.trim()} />
                  </label>
                  <div class="metadata-form__row">
                    <label>
                      <span>发行编号</span>
                      <InputText v-model={albumDraft.albumOrder} fluid />
                    </label>
                    <label>
                      <span>年份</span>
                      <InputText v-model={albumDraft.year} fluid />
                    </label>
                  </div>
                  <label>
                    <span>社团</span>
                    <MetadataTagsInput
                      modelValue={albumDraft.artists}
                      {...{
                        'onUpdate:modelValue': (values: string[]) => {
                          albumDraft.artists = values
                        },
                      }}
                      ariaLabel="社团"
                    />
                  </label>
                  <label>
                    <span>风格</span>
                    <MetadataTagsInput
                      modelValue={albumDraft.genres}
                      {...{
                        'onUpdate:modelValue': (values: string[]) => {
                          albumDraft.genres = values
                        },
                      }}
                      ariaLabel="风格"
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
                  <Button
                    label="保存"
                    disabled={!albumDraft.title.trim()}
                    onClick={saveAlbum}
                  />
                </>
              ),
            }}
          </Dialog>

        </div>
      )
    }
  },
})
