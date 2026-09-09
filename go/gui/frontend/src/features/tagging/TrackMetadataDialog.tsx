import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { defineComponent, type PropType, reactive, watch } from 'vue'

import type { PlanItemPreview } from '../../api'
import { t } from '../../i18n'
import { FieldLabel, FormField } from '../../shared/FormField'
import { Message } from '../../shared/Message'
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
      [() => props.visible, () => props.item],
      ([visible, item]) => {
        if (!visible || !item) {
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
                  <FieldLabel>{t('tagging.trackDialog.title')}</FieldLabel>
                  <InputText v-model={draft.title} autofocus fluid invalid={!draft.title.trim()} />
                </FormField>

                <FormField>
                  <FieldLabel>{t('tagging.trackDialog.artists')}</FieldLabel>
                  <MetadataTagsInput
                    modelValue={draft.artists}
                    {...{
                      'onUpdate:modelValue': (values: string[]) => {
                        draft.artists = values
                      },
                    }}
                  />
                  {draft.artists.length === 0 && (
                    <div class="text-sm font-normal text-amber-700 dark:text-amber-300">
                      {t('tagging.trackDialog.missingArtists')}
                    </div>
                  )}
                </FormField>

                <div class="grid grid-cols-2 gap-3">
                  <FormField>
                    <FieldLabel>{t('tagging.trackDialog.trackNumber')}</FieldLabel>
                    <InputText v-model={draft.trackNumber} fluid />
                  </FormField>
                  <FormField>
                    <FieldLabel>{t('tagging.trackDialog.discNumber')}</FieldLabel>
                    <InputText v-model={draft.discNumber} fluid />
                  </FormField>
                </div>

                <FormField>
                  <FieldLabel>{t('tagging.trackDialog.comments')}</FieldLabel>
                  <Textarea v-model={draft.comments} rows={6} fluid />
                </FormField>

                {props.item.issues.length > 0 && (
                  <Message severity="warn">
                    <div class="grid gap-1">
                      {props.item.issues.map(issue => (
                        <div key={issue.code}>{issue.message}</div>
                      ))}
                    </div>
                  </Message>
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
