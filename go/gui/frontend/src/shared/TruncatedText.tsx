import { defineComponent, h, resolveDirective, withDirectives } from 'vue'

export const TruncatedText = defineComponent({
  name: 'TruncatedText',
  inheritAttrs: false,
  props: {
    tooltip: String,
  },
  setup(props, { attrs, slots }) {
    const tooltipDirective = resolveDirective('tooltip')

    return () => {
      const node = h(
        'div',
        {
          ...attrs,
          class: [
            'w-fit min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap',
            attrs.class,
          ],
        },
        slots.default?.(),
      )

      return props.tooltip && tooltipDirective
        ? withDirectives(node, [[tooltipDirective, props.tooltip]])
        : node
    }
  },
})
