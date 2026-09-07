import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { defineComponent, type PropType, reactive, watch } from 'vue'

import type { PlanItemPreview } from '../../api'
import { t } from '../../i18n'
import { FormField } from '../../shared/FormField'
import { TruncatedText } from '../../shared/TruncatedText'
import { MetadataTagsInput } from './MetadataTagsInput'

export const TrackMetadataDialog = defineComponent({
  name: 'TrackMetadataDialog',
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    item: Object as PropType<PlanItemPreview>,
  },
  emits: ['update:visible', 'save'],
  setup(props, { emit }) {
    const draft = reactive({
      discNumber: '',
      trackNumber: '',
      title: '',
      artists: [] as string[],
      comments: '',
    })

    watch(
      () => props.item,
      item => {
        if (!item) {
          return
        }
        draft.discNumber = item.discNumber
        draft.trackNumber = item.trackNumber
        draft.title = item.title
        draft.artists = [...item.artists]
        draft.comments = item.comments
      },
      { immediate: true },
    )

    const save = () => {
      if (!props.item || !draft.title.trim()) {
        return
      }
      emit('save', {
        id: props.item.id,
        discNumber: draft.discNumber.trim(),
        trackNumber: draft.trackNumber.trim(),
        title: draft.title.trim(),
        artists: draft.artists,
        comments: draft.comments,
      })
      emit('update:visible', false)
    }

    return () => (
      <Dialog
        visible={props.visible}
        {...{ 'onUpdate:visible': (value: boolean) => emit('update:visible', value) }}
        modal
        header={t('tagging.trackDialog.header')}
        class="w-[min(560px,calc(100vw-2rem))]"
      >
        {{
          default: () =>
            props.item && (
              <div class="grid gap-3.5">
                <div class="grid min-w-0 gap-1.5 text-base">
                  <div class="font-semibold text-color">{t('tagging.trackDialog.localFile')}</div>
                  <TruncatedText class="font-normal text-color" tooltip={props.item.sourceName}>
                    {props.item.sourceName}
                  </TruncatedText>
                </div>

                <FormField
                  error={!draft.title.trim() ? t('validation.trackTitleRequired') : undefined}
                >
                  <div>{t('tagging.trackDialog.title')}</div>
                  <InputText v-model={draft.title} fluid invalid={!draft.title.trim()} />
                </FormField>

                <FormField>
                  <div>{t('tagging.trackDialog.artists')}</div>
                  <MetadataTagsInput
                    modelValue={draft.artists}
                    {...{
                      'onUpdate:modelValue': (values: string[]) => {
                        draft.artists = values
                      },
                    }}
                  />
                  {draft.artists.length === 0 && (
                    <div class="text-xs font-normal text-amber-700 dark:text-amber-300">
                      {t('tagging.trackDialog.missingArtists')}
                    </div>
                  )}
                </FormField>

                <div class="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                  <FormField>
                    <div>{t('tagging.trackDialog.trackNumber')}</div>
                    <InputText v-model={draft.trackNumber} fluid />
                  </FormField>
                  <FormField>
                    <div>{t('tagging.trackDialog.discNumber')}</div>
                    <InputText v-model={draft.discNumber} fluid />
                  </FormField>
                </div>

                <FormField>
                  <div>{t('tagging.trackDialog.comments')}</div>
                  <Textarea v-model={draft.comments} rows={6} fluid />
                </FormField>

                {props.item.issues.length > 0 && (
                  <div
                    class={[
                      'rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3',
                      'dark:border-amber-700 dark:bg-amber-950/50',
                    ]}
                  >
                    <div class="font-bold">{t('tagging.trackDialog.issues')}</div>
                    <div class="mt-1.5 grid gap-1 pl-4">
                      {props.item.issues.map(issue => (
                        <div key={issue.code} class="before:mr-2 before:content-['•']">
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ),
          footer: () => (
            <>
              <Button
                label={t('common.cancel')}
                severity="secondary"
                text
                onClick={() => emit('update:visible', false)}
              />
              <Button label={t('common.save')} disabled={!draft.title.trim()} onClick={save} />
            </>
          ),
        }}
      </Dialog>
    )
  },
})
