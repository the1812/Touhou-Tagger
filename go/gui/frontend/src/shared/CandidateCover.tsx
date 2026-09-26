import Image from 'primevue/image'
import { defineComponent, ref, watch } from 'vue'

import { t } from '../i18n'
import { CoverPlaceholder } from './CoverPlaceholder'

export const CandidateCover = defineComponent({
  name: 'CandidateCover',
  props: {
    url: String,
    title: { type: String, required: true },
  },
  setup(props) {
    const failed = ref(false)
    watch(
      () => props.url,
      () => {
        failed.value = false
      },
    )

    return () =>
      !props.url || failed.value ? (
        <CoverPlaceholder compact v-tooltip={t('tagging.cover.noCover')} />
      ) : (
        <div class="flex shrink-0 items-center justify-center overflow-hidden rounded bg-surface-100 text-muted-color dark:bg-surface-800">
          <Image
            key={props.url}
            src={props.url}
            class="block size-full"
            imageClass="block size-full object-contain"
            pt={{
              image: {
                alt: props.title,
                onError: () => {
                  failed.value = true
                },
              },
            }}
          />
        </div>
      )
  },
})
