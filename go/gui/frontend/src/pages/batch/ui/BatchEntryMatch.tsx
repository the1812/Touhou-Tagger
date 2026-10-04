import Button from 'primevue/button'
import Select from 'primevue/select'
import { defineComponent, type PropType } from 'vue'

import type { BatchEntryPreview } from '../../../shared/api'
import { batchMatchText } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { CandidateOption, TruncatedText } from '../../../shared/ui'
import { candidateOptions } from '../lib/batchEntryDisplay'

export const BatchEntryMatch = defineComponent({
  name: 'BatchEntryMatch',
  props: {
    entry: { type: Object as PropType<BatchEntryPreview>, required: true },
    editable: Boolean,
    disabled: Boolean,
    loading: Boolean,
  },
  emits: {
    resolve: (entryId: string, candidateId: string) => Boolean(entryId && candidateId),
    retry: (entryId: string) => Boolean(entryId),
  },
  setup(props, { emit }) {
    return () => {
      const { entry, loading } = props
      if (!props.editable) {
        return <TruncatedText class="block">{batchMatchText(entry, loading)}</TruncatedText>
      }
      if (loading || entry.readiness === 'pending') {
        return <div class="text-muted-color">{batchMatchText(entry, loading)}</div>
      }
      const blockedWithoutAlternatives =
        entry.readiness === 'blocked' && entry.candidates.length <= 1
      const canReload =
        blockedWithoutAlternatives ||
        entry.issues.some(issue => issue.code === 'scan-failed' || issue.code === 'load-failed')
      if (canReload) {
        return (
          <div class="flex items-center justify-between gap-2">
            <TruncatedText class="block text-red-600 dark:text-red-300">
              {batchMatchText(entry, loading)}
            </TruncatedText>
            <Button
              label={t('common.retry')}
              size="small"
              severity="danger"
              text
              loading={props.loading}
              disabled={props.disabled}
              onClick={() => emit('retry', entry.id)}
            />
          </div>
        )
      }
      if (entry.readiness === 'skipped' || entry.candidates.length === 0) {
        return <div class="text-muted-color">{batchMatchText(entry, loading)}</div>
      }
      if (
        entry.candidates.length > 1 ||
        entry.candidates.some(candidate => !candidate.exactMatch) ||
        entry.readiness === 'needs-candidate'
      ) {
        return (
          <Select
            size="small"
            modelValue={entry.selectedCandidateId}
            {...{
              'onUpdate:modelValue': (value: unknown) => emit('resolve', entry.id, String(value)),
            }}
            options={candidateOptions(entry)}
            optionLabel="label"
            optionValue="value"
            placeholder={t('batch.selectAlbum')}
            fluid
            loading={props.loading}
            disabled={props.disabled}
            overlayClass="[&_.p-select-option]:p-0!"
            v-slots={{
              option: ({ option }: { option: ReturnType<typeof candidateOptions>[number] }) => (
                <CandidateOption candidate={option.candidate} />
              ),
            }}
          />
        )
      }
      return <TruncatedText class="block">{batchMatchText(entry, loading)}</TruncatedText>
    }
  },
})
