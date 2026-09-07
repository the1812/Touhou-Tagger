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
      >
        {{
          chipicon: ({
            class: iconClass,
            removeCallback,
          }: {
            class?: string
            removeCallback: (event: Event) => void
          }) => <X class={iconClass} onClick={event => removeCallback(event)} />,
        }}
      </AutoComplete>
    )
  },
})
