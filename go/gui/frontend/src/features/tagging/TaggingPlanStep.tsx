import { Pencil } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ToggleSwitch from 'primevue/toggleswitch'
import { defineComponent, ref } from 'vue'
import { Translation } from 'vue-i18n'

import type { PlanItemPreview } from '../../api'
import { t } from '../../i18n'
import { PageActionBar } from '../../shared/PageActionBar'
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
          <section
            class={[
              'workspace-section grid w-full grid-cols-[var(--spacing-app-cover)_minmax(300px,1fr)] gap-4',
              'max-[1100px]:grid-cols-1',
            ]}
          >
            <div class="grid w-app-cover content-start gap-3">
              <CoverPreview cover={currentPlan.cover} />
              {currentPlan.options.canSaveCover && (
                <label class="flex items-center justify-center gap-3 [&>strong]:text-sm">
                  <ToggleSwitch
                    modelValue={currentPlan.options.saveCover}
                    {...{
                      'onUpdate:modelValue': (value: boolean) => workspace.updateSaveCover(value),
                    }}
                    disabled={isBusy.value}
                  />
                  <strong>
                    {summary.value?.localCover.exists
                      ? t('tagging.plan.overwriteCover')
                      : t('tagging.plan.saveOriginalCover')}
                  </strong>
                </label>
              )}
            </div>
            <div class="grid content-start gap-4">
              <div class="workspace-heading">
                <h2 class="mt-1 text-app-heading font-bold">{currentPlan.album.title}</h2>
                <Button
                  label={t('tagging.plan.editAlbum')}
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
              <div
                class={[
                  'grid gap-2 [&>span]:grid [&>span]:grid-cols-[4rem_minmax(0,1fr)]',
                  '[&>span]:text-sm [&>span]:text-muted-color [&_strong]:text-color',
                ]}
              >
                <span>
                  <strong>{t('tagging.plan.circles')}</strong>
                  {currentPlan.album.artists.join(' / ') || '—'}
                </span>
                <span>
                  <strong>{t('tagging.plan.year')}</strong>
                  {currentPlan.album.year || '—'}
                </span>
                <span>
                  <strong>{t('tagging.plan.catalogNumber')}</strong>
                  {currentPlan.album.albumOrder || '—'}
                </span>
                <span>
                  <strong>{t('tagging.plan.genres')}</strong>
                  {currentPlan.album.genres.join(' / ') || '—'}
                </span>
                <span>
                  <strong>{t('tagging.plan.source')}</strong>
                  {currentPlan.candidate.sourceLabel}
                </span>
              </div>
            </div>
          </section>

          <section class="workspace-section grid min-h-[380px] w-full gap-4 border-b-0">
            <h2 class="m-0 text-base font-bold">
              {t('tagging.plan.trackCount', { count: currentPlan.items.length })}
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
            <PlanTable items={currentPlan.items} disabled={isBusy.value} onEdit={openTrack} />
          </section>

          <PageActionBar>
            <span class="text-[.85rem] text-muted-color [&_strong]:text-color">
              <Translation
                keypath="tagging.plan.writeFiles"
                scope="global"
                v-slots={{
                  count: () => <strong>{currentPlan.options.writeFiles}</strong>,
                }}
              />
              {currentPlan.options.saveCover &&
                (summary.value?.localCover.exists
                  ? t('tagging.plan.overwriteCoverSuffix')
                  : t('tagging.plan.saveOriginalCoverSuffix'))}
            </span>
            <div class="flex items-center gap-4">
              <Button
                label={t('common.previous')}
                severity="secondary"
                text
                disabled={isBusy.value}
                onClick={() => workspace.backToSearch()}
              />
              <span
                class="inline-flex"
                v-tooltip={{
                  value: t('tagging.plan.blockingIssues', {
                    count: blockingIssues.value.length,
                  }),
                  disabled: blockingIssues.value.length === 0,
                }}
              >
                <Button
                  label={t('tagging.plan.writeTracks', {
                    count: currentPlan.options.writeFiles,
                  })}
                  size="large"
                  disabled={!canCommit.value}
                  onClick={() => workspace.commit()}
                />
              </span>
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
            onSave={track => workspace.updateTrack(track)}
          />
          <AlbumMetadataDialog
            visible={albumDialogVisible.value}
            album={currentPlan.album}
            {...{
              'onUpdate:visible': (value: boolean) => {
                albumDialogVisible.value = value
              },
            }}
            onSave={album => workspace.updateAlbum(album)}
          />
        </>
      )
    }
  },
})
