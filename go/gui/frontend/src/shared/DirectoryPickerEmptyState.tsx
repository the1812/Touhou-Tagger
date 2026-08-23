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
      <section {...attrs} class={['page-empty-state', attrs.class]}>
        {slots.default?.() ?? (
          <>
            <Button
              class="directory-picker-button"
              label={props.label || t('common.selectDirectory')}
              size="large"
              loading={props.loading}
              onClick={() => emit('select')}
            >
              {{ icon: () => <FolderOpen size={19} /> }}
            </Button>
            <span class="text-app-caption text-surface-500 dark:text-surface-400">
              <kbd class="app-kbd">Ctrl</kbd> + <kbd class="app-kbd">O</kbd>
            </span>
          </>
        )}
      </section>
    )
  },
})
