import { Check, ExternalLink, RotateCcw, TriangleAlert } from 'lucide-vue-next'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { defineComponent } from 'vue'

import { t } from '../i18n'

export const CompletionDialog = defineComponent({
  name: 'CompletionDialog',
  props: {
    visible: Boolean,
    title: { type: String, required: true },
    warning: Boolean,
    retryable: Boolean,
    details: String,
  },
  emits: { reveal: () => true, retry: () => true, close: () => true },
  setup(props, { emit }) {
    return () => (
      <Dialog
        visible={props.visible}
        modal
        class="w-[min(560px,calc(100vw-2rem))]"
        {...{
          'onUpdate:visible': (visible: boolean) => {
            if (!visible) emit('close')
          },
        }}
      >
        {{
          header: () => (
            <div class="flex items-center gap-3 font-semibold text-lg">
              {props.warning ? (
                <TriangleAlert class="shrink-0 text-amber-500" />
              ) : (
                <Check class="shrink-0 text-primary" />
              )}
              <div>{props.title}</div>
            </div>
          ),
          default: () =>
            props.details ? (
              <div class="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm text-muted-color">
                {props.details}
              </div>
            ) : null,
          footer: () => (
            <div class="flex flex-wrap justify-end gap-2">
              <Button
                label={t('common.revealDirectory')}
                severity="secondary"
                outlined
                onClick={() => emit('reveal')}
              >
                {{ icon: () => <ExternalLink /> }}
              </Button>
              {props.retryable && (
                <Button
                  label={t('operation.retryFailedOnly')}
                  severity="secondary"
                  outlined
                  onClick={() => emit('retry')}
                >
                  {{ icon: () => <RotateCcw /> }}
                </Button>
              )}
              <Button label={t('common.complete')} onClick={() => emit('close')} autofocus />
            </div>
          ),
        }}
      </Dialog>
    )
  },
})
