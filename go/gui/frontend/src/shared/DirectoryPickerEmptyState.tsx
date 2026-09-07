import { FolderOpen } from 'lucide-vue-next'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

import { t } from '../i18n'

export const DirectoryPickerEmptyState = defineComponent({
  name: 'DirectoryPickerEmptyState',
  inheritAttrs: false,
  props: {
    loading: Boolean,
    label: String,
  },
  emits: {
    select: () => true,
  },
  setup(props, { attrs, emit, slots }) {
    return () => (
      <div {...attrs} class={['page-empty-state', attrs.class]}>
        {slots.default?.() ?? (
          <>
            <Button
              class="w-48"
              label={props.label || t('common.selectDirectory')}
              size="large"
              loading={props.loading}
              onClick={() => emit('select')}
            >
              {{ icon: () => <FolderOpen /> }}
            </Button>
            <div class="flex items-center gap-1 text-sm text-surface-500 dark:text-surface-400">
              <div class="app-kbd">Ctrl</div> + <div class="app-kbd">O</div>
            </div>
          </>
        )}
      </div>
    )
  },
})
