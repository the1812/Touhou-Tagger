import { X } from 'lucide-vue-next'
import AutoComplete from 'primevue/autocomplete'
import { defineComponent, type PropType } from 'vue'

const normalizeValues = (values: string[]) => [
  ...new Set(values.map(value => value.trim()).filter(Boolean)),
]

export const MetadataTagsInput = defineComponent({
  name: 'MetadataTagsInput',
  props: {
    modelValue: {
      type: Array as PropType<string[]>,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => (
      <AutoComplete
        modelValue={props.modelValue}
        {...{
          'onUpdate:modelValue': (values: string[]) =>
            emit('update:modelValue', normalizeValues(values)),
        }}
        multiple
        typeahead={false}
        fluid
        size="small"
        class="text-[.82rem]"
        pt={{
          inputMultiple: { class: 'min-h-[34px] gap-1 px-2 py-1' },
          pcChip: { root: { class: 'px-1.5 py-0.5 text-[.78rem]' } },
          inputChip: { class: '[&_input]:text-[.82rem]' },
        }}
      >
        {{
          chipicon: ({
            class: iconClass,
            removeCallback,
          }: {
            class?: string
            removeCallback: (event: Event) => void
          }) => <X class={iconClass} size={13} onClick={event => removeCallback(event)} />,
        }}
      </AutoComplete>
    )
  },
})
