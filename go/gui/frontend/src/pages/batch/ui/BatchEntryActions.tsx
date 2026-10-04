import { ExternalLink, Trash2 } from '@lucide/vue'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

import { t } from '../../../shared/i18n'

export const BatchEntryActions = defineComponent({
  name: 'BatchEntryActions',
  props: { disabled: Boolean },
  emits: { reveal: () => true, remove: () => true },
  setup(props, { emit }) {
    return () => (
      <div class="flex w-max items-center">
        <Button
          text
          rounded
          severity="secondary"
          v-tooltip={t('common.revealDirectory')}
          onClick={() => emit('reveal')}
        >
          {{ icon: () => <ExternalLink /> }}
        </Button>
        <Button
          text
          rounded
          severity="secondary"
          v-tooltip={t('batch.removeEntry')}
          disabled={props.disabled}
          onClick={() => emit('remove')}
        >
          {{ icon: () => <Trash2 /> }}
        </Button>
      </div>
    )
  },
})
