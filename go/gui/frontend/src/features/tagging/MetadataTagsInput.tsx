import { defineComponent, type PropType } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import { X } from 'lucide-vue-next'

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
    ariaLabel: {
      type: String,
      required: true,
    },
  },
  emits: {
    'update:modelValue': (_value: string[]) => true,
  },
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
        ariaLabel={props.ariaLabel}
      >
        {{
          chipicon: ({ class: iconClass, removeCallback }: {
            class?: string
            removeCallback: (event: Event) => void
          }) => (
            <X
              class={iconClass}
              size={13}
              onClick={event => removeCallback(event)}
            />
          ),
        }}
      </AutoComplete>
    )
  },
})
