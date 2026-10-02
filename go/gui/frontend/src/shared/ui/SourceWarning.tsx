import { defineComponent } from 'vue'

import { t } from '../i18n'
import { Message } from './Message'

export const SourceWarning = defineComponent({
  name: 'SourceWarning',
  props: {
    source: { type: String, required: true },
  },
  setup(props) {
    return () => {
      const showWarning = props.source === 'music-brainz' || props.source === 'discogs'
      return (
        showWarning && (
          <Message severity="warn" variant="simple">
            {t('data.sourceMissingFields')}
          </Message>
        )
      )
    }
  },
})
