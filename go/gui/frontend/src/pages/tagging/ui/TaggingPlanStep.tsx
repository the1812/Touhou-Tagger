import { Pencil } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { defineComponent } from 'vue'

import { useWorkspaceStore } from '../../../features/workspace'
import type { PlanItemPreview } from '../../../shared/api'
import { issueText } from '../../../shared/api'
import { sourceLabel, t } from '../../../shared/i18n'
import { Message, WorkspaceTitle } from '../../../shared/ui'
import { usePlanEditor } from '../model/usePlanEditor'
import { AlbumMetadataDialog } from './AlbumMetadataDialog'
import { CoverPreview } from './CoverPreview'
import { PlanTable } from './PlanTable'
import { TaggingPlanActionBar } from './TaggingPlanActionBar'
import { TrackMetadataDialog } from './TrackMetadataDialog'

export const TaggingPlanStep = defineComponent({
  name: 'TaggingPlanStep',
  setup() {
    const workspace = useWorkspaceStore()
    const { plan, summary, stalePlan, isBusy } = storeToRefs(workspace)
    const editor = usePlanEditor(workspace)
    const openTrack = (item: PlanItemPreview) => {
      if (!isBusy.value && !stalePlan.value) {
        editor.openTrack(item.id)
      }
    }

    return () => {
      const currentPlan = plan.value
      if (!currentPlan) {
        return null
      }

      const stale = stalePlan.value
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
                    disabled={isBusy.value || stale}
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
                  disabled={isBusy.value || stale}
                  onClick={() => {
                    editor.openAlbum()
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
                  {sourceLabel(currentPlan.source)}
                </div>
              </div>
            </div>
          </div>

          <div class="workspace-section grid w-full content-start gap-4">
            {currentPlan.issues.map(issue => (
              <Message key={issue.code} severity={issue.severity === 'error' ? 'error' : 'warn'}>
                {issueText(issue)}
              </Message>
            ))}
            <PlanTable
              items={currentPlan.items}
              disabled={isBusy.value || stale}
              onEdit={openTrack}
            />
          </div>

          <TaggingPlanActionBar />

          <TrackMetadataDialog
            visible={editor.kind.value === 'track'}
            draft={editor.trackDraft.value}
            busy={isBusy.value}
            item={editor.selectedTrack.value}
            {...{
              'onUpdate:draft': editor.updateTrackDraft,
              onClose: editor.close,
              onSave: editor.saveTrack,
            }}
          />
          <AlbumMetadataDialog
            visible={editor.kind.value === 'album'}
            draft={editor.albumDraft.value}
            busy={isBusy.value}
            {...{
              'onUpdate:draft': editor.updateAlbumDraft,
              onClose: editor.close,
              onSave: editor.saveAlbum,
            }}
          />
        </>
      )
    }
  },
})
