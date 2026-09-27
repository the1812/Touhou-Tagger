import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { defineComponent, type PropType } from 'vue'

import type { PlanItemPreview } from '../../../shared/api'
import { issueText } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { FieldLabel, FormField, Message, TruncatedText } from '../../../shared/ui'
import { MetadataTagsInput } from './MetadataTagsInput'

export const TrackMetadataDialog = defineComponent({
  name: 'TrackMetadataDialog',
  props: {
    visible: { type: Boolean, required: true },
    item: Object as PropType<PlanItemPreview>,
    draft: Object as PropType<
      Pick<PlanItemPreview, 'discNumber' | 'trackNumber' | 'title' | 'artists' | 'comments'>
    >,
    busy: Boolean,
  },
  emits: ['update:draft', 'close', 'save'],
  setup(props, { emit }) {
    const update = (
      patch: Partial<
        Pick<PlanItemPreview, 'discNumber' | 'trackNumber' | 'title' | 'artists' | 'comments'>
      >,
    ) => {
      if (props.draft) {
        emit('update:draft', { ...props.draft, ...patch })
      }
    }
    return () => (
      <Dialog
        visible={props.visible}
        {...{ 'onUpdate:visible': (value: boolean) => !value && emit('close') }}
        modal
        header={t('tagging.trackDialog.header')}
        class="w-[min(560px,calc(100vw-2rem))]"
      >
        {{
          default: () =>
            props.item &&
            props.draft && (
              <div class="grid gap-3.5">
                <div class="grid min-w-0 gap-1.5 text-base">
                  <div class="font-semibold text-color">{t('tagging.trackDialog.localFile')}</div>
                  <TruncatedText class="font-normal text-color" tooltip={props.item.sourceName}>
                    {props.item.sourceName}
                  </TruncatedText>
                </div>
                <FormField
                  error={!props.draft.title.trim() ? t('validation.trackTitleRequired') : undefined}
                >
                  <FieldLabel for="tagging-trackDialog-title">
                    {t('tagging.trackDialog.title')}
                  </FieldLabel>
                  <InputText
                    id="tagging-trackDialog-title"
                    modelValue={props.draft.title}
                    {...{ 'onUpdate:modelValue': (title: string) => update({ title }) }}
                    autofocus
                    fluid
                    invalid={!props.draft.title.trim()}
                    disabled={props.busy}
                  />
                </FormField>
                <FormField>
                  <FieldLabel for="tagging-trackDialog-artists">
                    {t('tagging.trackDialog.artists')}
                  </FieldLabel>
                  <MetadataTagsInput
                    inputId="tagging-trackDialog-artists"
                    modelValue={props.draft.artists}
                    disabled={props.busy}
                    {...{ 'onUpdate:modelValue': (artists: string[]) => update({ artists }) }}
                  />
                  {props.draft.artists.length === 0 && (
                    <div class="text-sm font-normal text-amber-700 dark:text-amber-300">
                      {t('tagging.trackDialog.missingArtists')}
                    </div>
                  )}
                </FormField>
                <div class="grid grid-cols-2 gap-3">
                  <FormField>
                    <FieldLabel for="tagging-trackDialog-trackNumber">
                      {t('tagging.trackDialog.trackNumber')}
                    </FieldLabel>
                    <InputText
                      id="tagging-trackDialog-trackNumber"
                      modelValue={props.draft.trackNumber}
                      {...{
                        'onUpdate:modelValue': (trackNumber: string) => update({ trackNumber }),
                      }}
                      fluid
                      disabled={props.busy}
                    />
                  </FormField>
                  <FormField>
                    <FieldLabel for="tagging-trackDialog-discNumber">
                      {t('tagging.trackDialog.discNumber')}
                    </FieldLabel>
                    <InputText
                      id="tagging-trackDialog-discNumber"
                      modelValue={props.draft.discNumber}
                      {...{ 'onUpdate:modelValue': (discNumber: string) => update({ discNumber }) }}
                      fluid
                      disabled={props.busy}
                    />
                  </FormField>
                </div>
                <FormField>
                  <FieldLabel for="tagging-trackDialog-comments">
                    {t('tagging.trackDialog.comments')}
                  </FieldLabel>
                  <Textarea
                    id="tagging-trackDialog-comments"
                    modelValue={props.draft.comments}
                    {...{ 'onUpdate:modelValue': (comments: string) => update({ comments }) }}
                    rows={6}
                    fluid
                    disabled={props.busy}
                  />
                </FormField>
                {props.item.issues.length > 0 && (
                  <Message severity="warn">
                    <div class="grid gap-1">
                      {props.item.issues.map(issue => (
                        <div key={issue.code}>{issueText(issue)}</div>
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
                onClick={() => emit('close')}
              />
              <Button
                label={t('common.save')}
                disabled={props.busy || !props.draft?.title.trim()}
                onClick={() => emit('save')}
              />
            </>
          ),
        }}
      </Dialog>
    )
  },
})
