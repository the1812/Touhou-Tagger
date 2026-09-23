import Button from 'primevue/button'
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import { computed, defineComponent, onBeforeUnmount, ref } from 'vue'

import { getApi } from '../api'
import { batchDirectory, fixtureDirectory } from '../api/fixtureData'
import { progressMock, progressMockKind } from '../api/progressMock'
import type { OperationStage } from '../api/types'
import { router } from '../app/router'
import { useBatchStore } from '../stores/batch'
import { useWorkspaceStore } from '../stores/workspace'

const restarting = ref(false)

export const initializeProgressMock = async () => {
  if (restarting.value) return
  restarting.value = true
  try {
    if (progressMock.operation.value) progressMock.finish('cancel')
    if (progressMockKind === 'workspace') {
      await router.replace('/tagging')
      const workspace = useWorkspaceStore()
      await workspace.scan(fixtureDirectory)
      if (!workspace.plan) {
        workspace.selectCandidate('fixture:single-disc')
        await workspace.preparePlan()
      }
      await workspace.commit()
    } else if (progressMockKind === 'batch') {
      await router.replace('/batch')
      const api = await getApi()
      const batch = useBatchStore()
      batch.directory = batchDirectory
      const preview = await api.scanBatch(batchDirectory, batch.depth, 'thb-wiki')
      for (const job of preview.jobs) {
        const loaded = await api.loadBatchJob(preview.batchId, job.id)
        Object.assign(
          job,
          await api.resolveBatchCandidate(preview.batchId, job.id, loaded.candidates[0].id),
        )
      }
      batch.preview = preview
      await batch.run()
    }
  } finally {
    restarting.value = false
  }
}

export const ProgressMockPanel = defineComponent({
  setup() {
    const stages: { label: string; value: OperationStage }[] = [
      { label: '准备', value: 'preparing' },
      { label: '重命名', value: 'renaming' },
      { label: '写入标签', value: 'writing' },
    ]
    const stageModel = computed({
      get: () => progressMock.operation.value?.stage,
      set: (stage: OperationStage) =>
        progressMock.update({
          stage,
          message: stages.find(item => item.value === stage)?.label ?? stage,
        }),
    })
    const currentModel = computed({
      get: () => progressMock.operation.value?.current ?? 0,
      set: (current: number) => progressMock.update({ current }),
    })
    const speed = ref(1000)
    const speeds = [
      { label: '慢速观察', value: 1000 },
      { label: '快速写入', value: 150 },
    ]
    const tick = () => {
      const operation = progressMock.operation.value
      if (!operation) return
      if (progressMockKind === 'batch' && operation.current < operation.total) {
        progressMock.update({ current: operation.current + 1 })
      } else {
        const next = stages.at(stages.findIndex(stage => stage.value === operation.stage) + 1)
        if (next) progressMock.update({ stage: next.value, current: 0, message: next.label })
        else progressMock.finish('success')
      }
    }
    let elapsed = 0
    const timer = window.setInterval(() => {
      if (!progressMock.playing.value) {
        elapsed = 0
        return
      }
      elapsed += 50
      if (elapsed >= speed.value) {
        elapsed = 0
        tick()
      }
    }, 50)
    onBeforeUnmount(() => window.clearInterval(timer))
    return () => {
      const operation = progressMock.operation.value
      return (
        <div class="shrink-0 border-t border-surface-200 bg-surface-0 p-3 dark:border-surface-700 dark:bg-surface-900">
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <div class="font-bold">{progressMockKind === 'batch' ? '批量' : '单个'}写入 Mock</div>
            <Button
              label={progressMock.playing.value ? '暂停' : '播放'}
              size="small"
              disabled={!operation}
              onClick={() => {
                progressMock.playing.value = !progressMock.playing.value
              }}
            />
            <Button label="下一步" size="small" outlined disabled={!operation} onClick={tick} />
            <Button
              label="重新开始"
              size="small"
              outlined
              loading={restarting.value}
              onClick={() =>
                void initializeProgressMock().then(() => {
                  progressMock.playing.value = speed.value === 150
                })
              }
            />
            <Select
              options={stages}
              optionLabel="label"
              optionValue="value"
              v-model={stageModel.value}
              disabled={!operation}
            />
            <Select
              options={speeds}
              optionLabel="label"
              optionValue="value"
              v-model={speed.value}
            />
            <Button
              label="成功"
              size="small"
              text
              disabled={!operation}
              onClick={() => progressMock.finish('success')}
            />
            <Button
              label="失败"
              size="small"
              text
              severity="danger"
              disabled={!operation}
              onClick={() => progressMock.finish('failure')}
            />
            <Button
              label="取消"
              size="small"
              text
              disabled={!operation?.cancellable}
              onClick={() => progressMock.finish('cancel')}
            />
          </div>
          {operation && progressMockKind === 'batch' && (
            <div class="mt-3 flex items-center gap-4 text-sm">
              <Slider
                class="flex-1"
                min={0}
                max={operation.total}
                step={1}
                v-model={currentModel.value}
              />
              <div>
                {operation.current} / {operation.total}
              </div>
            </div>
          )}
        </div>
      )
    }
  },
})
