import { Check, Copy, Info, TriangleAlert, X } from 'lucide-vue-next'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { defineComponent, watch } from 'vue'

import { t } from '../i18n'
import { type ProcessNotification, useNotificationsStore } from '../stores/notifications'

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
        const message: ToastMessageOptions & { data: ProcessNotification } = {
          group: 'process',
          severity: notification.severity,
          summary: notification.summary,
          detail: notification.detail,
          life: notification.sticky ? undefined : notification.severity === 'error' ? 7000 : 3500,
          closable: true,
          data: notification,
        }
        toast.add(message)
      },
      { deep: true },
    )

    const copyDetails = async (details: string) => {
      try {
        await navigator.clipboard.writeText(details)
      } catch (error) {
        notifications.error(t('common.copyDetailsFailed'), error)
      }
    }

    return () => (
      <Toast group="process" position="top-right">
        {{
          container: ({
            message,
            closeCallback,
          }: {
            message: ToastSlotMessage
            closeCallback: () => void
          }) => {
            const diagnostics = message.data?.diagnostics
            return (
              <div
                class={[
                  'grid w-full grid-cols-[20px_minmax(0,1fr)_20px]',
                  'items-start gap-x-3 gap-y-1 p-3.5',
                ]}
              >
                {message.severity === 'success' ? (
                  <Check class="self-center size-[20px]" />
                ) : message.severity === 'info' ? (
                  <Info class="self-center size-[20px]" />
                ) : (
                  <TriangleAlert class="self-center size-[20px]" />
                )}
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
                  <div class="text-(--p-toast-detail-color) text-(length:--p-toast-detail-font-size) font-(--p-toast-detail-font-weight) leading-[1.45]">
                    {message.detail}
                  </div>
                  {diagnostics && (
                    <Button
                      label={t('common.copyDetails')}
                      size="small"
                      severity="secondary"
                      text
                      class="-ml-2 mt-1 justify-self-start"
                      onClick={() => copyDetails(diagnostics)}
                    >
                      {{ icon: () => <Copy /> }}
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
