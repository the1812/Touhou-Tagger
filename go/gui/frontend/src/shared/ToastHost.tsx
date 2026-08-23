import { Check, Copy, Info, TriangleAlert } from 'lucide-vue-next'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { defineComponent, watch } from 'vue'

import { type ProcessNotification, useNotificationsStore } from '../stores/notifications'
import { t } from '../i18n'

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
          message: ({ message }: { message: ToastSlotMessage }) => {
            const diagnostics = message.data?.diagnostics
            return (
              <div class="flex w-[min(360px,calc(100vw-48px))] items-start gap-3">
                {message.severity === 'success' ? (
                  <Check size={20} />
                ) : message.severity === 'info' ? (
                  <Info size={20} />
                ) : (
                  <TriangleAlert size={20} />
                )}
                <div class="grid min-w-0 gap-1">
                  <strong>{message.summary}</strong>
                  <span class="text-muted-color leading-[1.45]">{message.detail}</span>
                  {diagnostics && (
                    <Button
                      label={t('common.copyDetails')}
                      size="small"
                      severity="secondary"
                      text
                      class="-ml-2 mt-1 justify-self-start"
                      onClick={() => copyDetails(diagnostics)}
                    >
                      {{ icon: () => <Copy size={14} /> }}
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
