import type { TooltipOptions } from 'primevue/tooltip'
import { computed, defineComponent, withDirectives, type PropType } from 'vue'

import type { AlbumCandidate } from '../api'
import { metadataSources } from '../config'
import { t } from '../i18n'
import { Tooltip } from '../lib/tooltip'
import { coverPlaceholderHTML } from './CoverPlaceholder'
import { TruncatedText } from './TruncatedText'

export const CandidateOption = defineComponent({
  name: 'CandidateOption',
  props: {
    candidate: { type: Object as PropType<AlbumCandidate>, required: true },
  },
  setup(props) {
    const tooltip = computed<TooltipOptions>(() => {
      if (!metadataSources[props.candidate.source]?.supportsSearchCover) {
        return { disabled: true }
      }
      if (!props.candidate.thumbnailUrl) {
        return {
          value: coverPlaceholderHTML('size-60 max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]'),
          escape: false,
          class: 'max-w-none! [&_.p-tooltip-text]:p-2!',
        }
      }
      const template = document.createElement('template')
      template.innerHTML =
        '<img class="block size-60 max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain">'
      const image = template.content.firstElementChild as HTMLImageElement
      image.src = props.candidate.thumbnailUrl
      image.alt = t('data.noCover')
      return {
        value: template.innerHTML,
        escape: false,
        class: 'max-w-none! [&_.p-tooltip-text]:p-2!',
      }
    })

    return () =>
      withDirectives(
        <div class="min-w-0 flex-1 px-3 py-2">
          <TruncatedText>{props.candidate.title}</TruncatedText>
          {props.candidate.artists.length > 0 && (
            <TruncatedText class="text-sm text-muted-color">
              {props.candidate.artists.join(' / ')}
            </TruncatedText>
          )}
        </div>,
        [[Tooltip, tooltip.value, undefined, { left: true }]],
      )
  },
})
