import { defineComponent } from 'vue'

import { errorMessage } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { CompletionDialog } from '../../../shared/ui'
import { useDumpStore } from '../model'

export const DumpCompletionDialog = defineComponent({
  name: 'DumpCompletionDialog',
  setup() {
    const dump = useDumpStore()
    return () => {
      const { completion } = dump
      const result = completion?.kind === 'result' ? completion.result : undefined
      const error = completion?.kind === 'failure' ? completion.error : undefined
      return (
        <CompletionDialog
          visible={Boolean(completion)}
          title={result ? t('dump.complete', { count: result.audioCount }) : t('dump.failed')}
          warning={Boolean(error)}
          details={error ? errorMessage(error) : undefined}
          revealable={Boolean(result)}
          closeLabel={t('dump.close')}
          onReveal={() => void dump.reveal()}
          onClose={dump.closeCompletion}
        />
      )
    }
  },
})
