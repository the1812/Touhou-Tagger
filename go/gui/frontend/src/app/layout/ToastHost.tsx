import { Check, Copy, ExternalLink, Info, RotateCcw, TriangleAlert, X } from '@lucide/vue'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { defineComponent, watch } from 'vue'

import { type ProcessNotification, useNotificationsStore } from '../../entities/session'
import { getApi } from '../../shared/api'
import { t } from '../../shared/i18n'

interface ToastSlotMessage extends ToastMessageOptions {
  data?: ProcessNotification
}

export const ToastHost = defineComponent({
  name: 'ToastHost',
  setup() {
    const notifications = useNotificationsStore()
    const toast = useToast()

    watch(
      () => notifications.latest,
      notification => {
        if (!notification) {
          return
        }
        const life =
          notification.severity === 'error' || notification.severity === 'warn' ? 7000 : 3500
        const message: ToastMessageOptions & { data: ProcessNotification } = {
          group: 'process',
          severity: notification.severity,
          summary: notification.summary,
          detail: notification.detail,
          life: notification.sticky ? undefined : life,
          closable: true,
          data: notification,
        }
        toast.add(message)
      },
      { flush: 'sync' },
    )

    const copyDetails = async (details: string) => {
      try {
        await navigator.clipboard.writeText(details)
      } catch (error) {
        notifications.error(t('common.copyDetailsFailed'), error)
      }
    }

    const revealDirectory = async (directory: string) => {
      try {
        await (await getApi()).revealDirectory(directory)
      } catch (error) {
        notifications.error(t('notifications.revealDirectoryFailed'), error)
      }
    }

    return () => (
      <Toast
        group="process"
        position="top-right"
        // PrimeVue requires hover callbacks to pause and resume its timer.
        onMouseEnter={() => undefined}
        onMouseLeave={() => undefined}
      >
        {{
          container: ({
            message,
            closeCallback,
          }: {
            message: ToastSlotMessage
            closeCallback: () => void
          }) => {
            const diagnostics = message.data?.diagnostics
            const directory = message.data?.directory
            const retry = message.data?.retry
            const icons: Partial<Record<string, typeof Check>> = { success: Check, info: Info }
            const Icon = icons[message.severity ?? ''] ?? TriangleAlert
            return (
              <div
                class={[
                  'grid w-full grid-cols-[20px_minmax(0,1fr)_20px]',
                  'items-start gap-x-3 gap-y-1 p-3.5',
                ]}
              >
                <Icon class="self-center size-[20px]" />
                <div class="min-w-0 self-center text-(length:--p-toast-summary-font-size) font-(--p-toast-summary-font-weight)">
                  {message.summary}
                </div>
                <Button
                  unstyled
                  type="button"
                  class={[
                    'grid size-5 cursor-pointer place-items-center self-center rounded text-current opacity-70',
                    'transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2',
                  ]}
                  onClick={closeCallback}
                >
                  <X class="size-[20px]" />
                </Button>
                <div class="col-start-2 col-end-4 grid min-w-0 gap-1">
                  {message.detail && (
                    <div class="wrap-anywhere whitespace-pre-wrap text-(--p-toast-detail-color) text-(length:--p-toast-detail-font-size) font-(--p-toast-detail-font-weight) leading-[1.45]">
                      {message.detail}
                    </div>
                  )}
                  {directory && (
                    <Button
                      label={t('common.revealDirectory')}
                      size="small"
                      severity="secondary"
                      text
                      class="-ml-2 mt-1 justify-self-start"
                      onClick={() => void revealDirectory(directory)}
                    >
                      {{ icon: () => <ExternalLink /> }}
                    </Button>
                  )}
                  {diagnostics && (
                    <Button
                      label={t('common.copyDetails')}
                      size="small"
                      severity="secondary"
                      text
                      class="-ml-2 mt-1 justify-self-start"
                      onClick={() => void copyDetails(diagnostics)}
                    >
                      {{ icon: () => <Copy /> }}
                    </Button>
                  )}
                  {retry && (
                    <Button
                      label={t('operation.retryFailedOnly')}
                      size="small"
                      severity="secondary"
                      text
                      class="-ml-2 mt-1 justify-self-start"
                      disabled={retry.disabled()}
                      onClick={() => {
                        closeCallback()
                        retry.run()
                      }}
                    >
                      {{ icon: () => <RotateCcw /> }}
                    </Button>
                  )}
                </div>
              </div>
            )
          },
        }}
      </Toast>
    )
  },
})
