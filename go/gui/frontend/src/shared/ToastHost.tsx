import { defineComponent, watch } from 'vue'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { Check, Copy, Info, TriangleAlert } from 'lucide-vue-next'

import { type ProcessNotification, useNotificationsStore } from '../stores/notifications'

import './ToastHost.css'

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
          life: notification.sticky
            ? undefined
            : notification.severity === 'error'
              ? 7000
              : 3500,
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
        notifications.error('复制详情失败', error)
      }
    }

    return () => (
      <Toast group="process" position="top-right">
        {{
          message: ({ message }: { message: ToastSlotMessage }) => {
            const diagnostics = message.data?.diagnostics
            return (
              <div class="toast-message">
                {message.severity === 'success' ? (
                  <Check size={20} aria-hidden="true" />
                ) : message.severity === 'info' ? (
                  <Info size={20} aria-hidden="true" />
                ) : (
                  <TriangleAlert size={20} aria-hidden="true" />
                )}
                <div class="toast-message__content">
                  <strong>{message.summary}</strong>
                  <span>{message.detail}</span>
                  {diagnostics && (
                    <Button
                      label="复制详情"
                      size="small"
                      severity="secondary"
                      text
                      onClick={() => void copyDetails(diagnostics)}
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
