import { Play } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import { defineComponent } from 'vue'
import { Translation } from 'vue-i18n'

import { useWorkspaceStore } from '../../../features/workspace'
import { t } from '../../../shared/i18n'
import { useDelayedBusy } from '../../../shared/lib'
import { PageActionBar } from '../../../shared/ui'

export const TaggingPlanActionBar = defineComponent({
  name: 'TaggingPlanActionBar',
  setup() {
    const workspace = useWorkspaceStore()
    const { plan, summary, stalePlan, isWriting, isBusy, blockingIssues, canExecute } =
      storeToRefs(workspace)
    const showSpinner = useDelayedBusy(() => isWriting.value)
    return () => {
      const currentPlan = plan.value
      if (!currentPlan) {
        return null
      }
      const stale = stalePlan.value
      const idleAction = stale ? 'tagging.rescan' : 'common.start'
      const cannotExecute = !stale && !canExecute.value
      return (
        <PageActionBar
          v-slots={{
            status: () => (
              <>
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
              </>
            ),
            secondaryAction: () =>
              !summary.value?.hasMetadataJson && (
                <Button
                  label={t('common.previous')}
                  severity="secondary"
                  text
                  disabled={isBusy.value || stale}
                  onClick={() => void workspace.backToSearch()}
                />
              ),
            action: () => (
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
                  class="min-w-28"
                  label={t(isWriting.value ? 'operation.writing' : idleAction)}
                  loading={showSpinner.value}
                  disabled={isBusy.value || cannotExecute}
                  onClick={() =>
                    void (stale ? workspace.scan(workspace.directory) : workspace.execute())
                  }
                >
                  {{ icon: () => <Play /> }}
                </Button>
              </div>
            ),
          }}
        />
      )
    }
  },
})
