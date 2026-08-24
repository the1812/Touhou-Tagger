import PrimeVueTooltip from 'primevue/tooltip'
import type { DirectiveBinding, ObjectDirective } from 'vue'

const positionModifiers = ['top', 'right', 'bottom', 'left'] as const

const withDefaultPosition = (binding: DirectiveBinding): DirectiveBinding =>
  positionModifiers.some(position => binding.modifiers[position])
    ? binding
    : { ...binding, modifiers: { ...binding.modifiers, top: true } }

export const Tooltip: ObjectDirective = {
  ...PrimeVueTooltip,
  beforeMount(element, binding, vnode, previousVnode) {
    PrimeVueTooltip.beforeMount?.(
      element,
      withDefaultPosition(binding),
      vnode,
      previousVnode,
    )
  },
  updated(element, binding, vnode, previousVnode) {
    PrimeVueTooltip.updated?.(element, withDefaultPosition(binding), vnode, previousVnode)
  },
}
