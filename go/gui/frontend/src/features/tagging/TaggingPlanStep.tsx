import { Pencil, Play } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { defineComponent, ref } from 'vue'
import { Translation } from 'vue-i18n'

import type { TrackMetadataPatch, AlbumMetadataPatch, PlanItemPreview } from '../../api'
import { t } from '../../i18n'
import { Message } from '../../shared/Message'
import { PageActionBar } from '../../shared/PageActionBar'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useWorkspaceStore } from '../../stores/workspace'
import { AlbumMetadataDialog } from './AlbumMetadataDialog'
import { CoverPreview } from './CoverPreview'
import { PlanTable } from './PlanTable'
import { TrackMetadataDialog } from './TrackMetadataDialog'

export const TaggingPlanStep = defineComponent({
  name: 'TaggingPlanStep',
  setup() {
    const workspace = useWorkspaceStore()
    const { plan, summary, operation, result, isBusy, blockingIssues, canCommit } =
      storeToRefs(workspace)
    const selectedTrack = ref<PlanItemPreview>()
    const trackDialogVisible = ref(false)
    const albumDialogVisible = ref(false)

    const openTrack = (item: PlanItemPreview) => {
      if (isBusy.value) {
        return
      }
      selectedTrack.value = item
      trackDialogVisible.value = true
    }

    return () => {
      const currentPlan = plan.value
      if (!currentPlan || operation.value || result.value) {
        return null
      }

      return (
        <>
          <div class="workspace-section grid w-full grid-cols-[var(--spacing-app-cover)_minmax(300px,1fr)] gap-4">
            <div class="grid w-app-cover content-start gap-3">
              <CoverPreview cover={currentPlan.cover} />
              {currentPlan.options.canSaveCover && (
                <div class="flex items-center justify-center gap-3">
                  <ToggleSwitch
                    modelValue={currentPlan.options.saveCover}
                    {...{
                      'onUpdate:modelValue': (value: boolean) => workspace.updateSaveCover(value),
                    }}
                    disabled={isBusy.value}
                  />
                  <div class="text-base font-medium">
                    {summary.value?.localCover.exists
                      ? t('tagging.plan.overwriteCover')
                      : t('tagging.plan.saveOriginalCover')}
                  </div>
                </div>
              )}
            </div>
            <div class="grid content-start gap-4">
              <div class="workspace-heading">
                <WorkspaceTitle class="text-xl">{currentPlan.album.title}</WorkspaceTitle>
                <Button
                  label={t('tagging.plan.editAlbum')}
                  severity="secondary"
                  outlined
                  disabled={isBusy.value}
                  onClick={() => {
                    albumDialogVisible.value = true
                  }}
                >
                  {{ icon: () => <Pencil /> }}
                </Button>
              </div>
              <div
                class={[
                  'grid gap-2 [&>.metadata-row]:grid [&>.metadata-row]:grid-cols-[4rem_minmax(0,1fr)]',
                  '[&>.metadata-row]:text-base [&>.metadata-row]:text-muted-color',
                ]}
              >
                <div class="metadata-row">
                  <div class="font-medium text-color">{t('tagging.plan.circles')}</div>
                  {currentPlan.album.artists.join(' / ') || '—'}
                </div>
                <div class="metadata-row">
                  <div class="font-medium text-color">{t('tagging.plan.year')}</div>
                  {currentPlan.album.year || '—'}
                </div>
                <div class="metadata-row">
                  <div class="font-medium text-color">{t('tagging.plan.catalogNumber')}</div>
                  {currentPlan.album.albumOrder || '—'}
                </div>
                <div class="metadata-row">
                  <div class="font-medium text-color">{t('tagging.plan.genres')}</div>
                  {currentPlan.album.genres.join(' / ') || '—'}
                </div>
                <div class="metadata-row">
                  <div class="font-medium text-color">{t('tagging.plan.source')}</div>
                  {currentPlan.candidate.sourceLabel}
                </div>
              </div>
            </div>
          </div>

          <div class="workspace-section grid w-full content-start gap-4">
            {currentPlan.issues.map(issue => (
              <Message key={issue.code} severity={issue.severity === 'error' ? 'error' : 'warn'}>
                {issue.message}
              </Message>
            ))}
            <PlanTable items={currentPlan.items} disabled={isBusy.value} onEdit={openTrack} />
          </div>

          <PageActionBar>
            <div class="text-sm text-muted-color">
              <Translation
                keypath="tagging.plan.writeFiles"
                scope="global"
                v-slots={{
                  count: () => (
                    <div class="inline text-color">{currentPlan.options.writeFiles}</div>
                  ),
                }}
              />
              {currentPlan.options.saveCover &&
                (summary.value?.localCover.exists
                  ? t('tagging.plan.overwriteCoverSuffix')
                  : t('tagging.plan.saveOriginalCoverSuffix'))}
            </div>
            <div class="flex items-center gap-2">
              {!summary.value?.hasMetadataJson && (
                <Button
                  label={t('common.previous')}
                  severity="secondary"
                  text
                  disabled={isBusy.value}
                  onClick={() => void workspace.backToSearch()}
                />
              )}
              <div
                class="inline-flex"
                v-tooltip={{
                  value: t('tagging.plan.blockingIssues', {
                    count: blockingIssues.value.length,
                  }),
                  disabled: blockingIssues.value.length === 0,
                }}
              >
                <Button
                  label={t('common.start')}
                  disabled={!canCommit.value}
                  onClick={() => void workspace.commit()}
                >
                  {{ icon: () => <Play /> }}
                </Button>
              </div>
            </div>
          </PageActionBar>

          <TrackMetadataDialog
            visible={trackDialogVisible.value}
            {...{
              'onUpdate:visible': (value: boolean) => {
                trackDialogVisible.value = value
              },
            }}
            item={selectedTrack.value}
            onSave={(track: TrackMetadataPatch) => workspace.updateTrack(track)}
          />
          <AlbumMetadataDialog
            visible={albumDialogVisible.value}
            album={currentPlan.album}
            {...{
              'onUpdate:visible': (value: boolean) => {
                albumDialogVisible.value = value
              },
            }}
            onSave={(album: AlbumMetadataPatch) => workspace.updateAlbum(album)}
          />
        </>
      )
    }
  },
})
