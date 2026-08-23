import {
  defineComponent,
  h,
  resolveDirective,
  withDirectives,
} from 'vue'

export const TruncatedText = defineComponent({
  name: 'TruncatedText',
  inheritAttrs: false,
  props: {
    as: {
      type: String,
      default: 'span',
    },
    tooltip: String,
  },
  setup(props, { attrs, slots }) {
    const tooltipDirective = resolveDirective('tooltip')

    return () => {
      const node = h(
        props.as,
        {
          ...attrs,
          class: ['min-w-0 overflow-hidden text-ellipsis whitespace-nowrap', attrs.class],
        },
        slots.default?.(),
      )

      return props.tooltip && tooltipDirective
        ? withDirectives(node, [[tooltipDirective, props.tooltip]])
        : node
    }
  },
})
