import { FileJson } from '@lucide/vue'
import Image from 'primevue/image'
import Select, { type SelectProps } from 'primevue/select'
import { defineComponent, type PropType } from 'vue'

import type { SourceOption } from '../api'
import { sourceLabel } from '../i18n'
import discogsIcon from './assets/sources/discogs.svg'
import doujinMetaDarkIcon from './assets/sources/doujin-meta-dark.svg'
import doujinMetaIcon from './assets/sources/doujin-meta.svg'
import musicBrainzIcon from './assets/sources/musicbrainz.svg'
import thbWikiIcon from './assets/sources/thb-wiki.png'

const sourceIcons: Record<string, string> = {
  'thb-wiki': thbWikiIcon,
  'doujin-meta': doujinMetaIcon,
  'music-brainz': musicBrainzIcon,
  discogs: discogsIcon,
}

export const SourceSelect = defineComponent({
  name: 'SourceSelect',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, required: true },
    options: Array as PropType<SourceOption[]>,
    labelId: String,
    size: String as PropType<SelectProps['size']>,
    fluid: Boolean,
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    const renderSource = (value: string, label: string) => {
      return (
        <div class="flex items-center gap-2">
          {value === 'local-json' ? (
            <FileJson class="size-4 shrink-0" />
          ) : (
            <Image
              src={sourceIcons[value]}
              pt={{ image: { alt: '' } }}
              class={['size-4 shrink-0', value === 'doujin-meta' ? 'dark:hidden' : '']}
              imageClass={[
                'block size-full object-contain',
                value === 'discogs' ? 'dark:invert' : '',
              ].join(' ')}
            />
          )}
          {value === 'doujin-meta' && (
            <Image
              src={doujinMetaDarkIcon}
              pt={{ image: { alt: '' } }}
              class="hidden size-4 shrink-0 dark:block"
              imageClass="block size-full object-contain"
            />
          )}
          <div>{label}</div>
        </div>
      )
    }

    return () => (
      <Select
        {...attrs}
        {...props}
        optionLabel="label"
        optionValue="value"
        {...{ 'onUpdate:modelValue': (value: string) => emit('update:modelValue', value) }}
      >
        {{
          value: () => renderSource(props.modelValue, sourceLabel(props.modelValue)),
          option: ({ option }: { option: SourceOption }) =>
            renderSource(option.value, option.label),
        }}
      </Select>
    )
  },
})
