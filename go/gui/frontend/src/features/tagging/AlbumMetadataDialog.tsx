import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { defineComponent, type PropType } from 'vue'

import type { AlbumMetadata } from '../../api'
import { t } from '../../i18n'
import { FieldLabel } from '../../shared/FieldLabel'
import { FormField } from '../../shared/FormField'
import { MetadataTagsInput } from './MetadataTagsInput'

export const AlbumMetadataDialog = defineComponent({
  name: 'AlbumMetadataDialog',
  props: {
    visible: Boolean,
    draft: Object as PropType<AlbumMetadata>,
    busy: Boolean,
  },
  emits: ['update:draft', 'close', 'save'],
  setup(props, { emit }) {
    const update = (patch: Partial<AlbumMetadata>) => {
      if (props.draft) {
        emit('update:draft', { ...props.draft, ...patch })
      }
    }
    return () => (
      <Dialog
        visible={props.visible}
        {...{ 'onUpdate:visible': (value: boolean) => !value && emit('close') }}
        modal
        header={t('tagging.albumDialog.header')}
        class="w-[min(560px,calc(100vw-2rem))]"
      >
        {{
          default: () =>
            props.draft && (
              <div class="grid gap-3.5">
                <FormField>
                  <FieldLabel for="tagging-albumDialog-title">
                    {t('tagging.albumDialog.title')}
                  </FieldLabel>
                  <InputText
                    id="tagging-albumDialog-title"
                    modelValue={props.draft.title}
                    {...{ 'onUpdate:modelValue': (title: string) => update({ title }) }}
                    autofocus
                    fluid
                    invalid={!props.draft.title.trim()}
                    disabled={props.busy}
                  />
                </FormField>
                <div class="grid grid-cols-2 gap-3">
                  <FormField>
                    <FieldLabel for="tagging-albumDialog-catalogNumber">
                      {t('tagging.albumDialog.catalogNumber')}
                    </FieldLabel>
                    <InputText
                      id="tagging-albumDialog-catalogNumber"
                      modelValue={props.draft.albumOrder}
                      {...{ 'onUpdate:modelValue': (albumOrder: string) => update({ albumOrder }) }}
                      fluid
                      disabled={props.busy}
                    />
                  </FormField>
                  <FormField>
                    <FieldLabel for="tagging-albumDialog-year">
                      {t('tagging.albumDialog.year')}
                    </FieldLabel>
                    <InputText
                      id="tagging-albumDialog-year"
                      modelValue={props.draft.year}
                      {...{ 'onUpdate:modelValue': (year: string) => update({ year }) }}
                      fluid
                      disabled={props.busy}
                    />
                  </FormField>
                </div>
                <FormField>
                  <FieldLabel for="tagging-albumDialog-circles">
                    {t('tagging.albumDialog.circles')}
                  </FieldLabel>
                  <MetadataTagsInput
                    inputId="tagging-albumDialog-circles"
                    modelValue={props.draft.artists}
                    disabled={props.busy}
                    {...{
                      'onUpdate:modelValue': (artists: string[]) => update({ artists }),
                    }}
                  />
                </FormField>
                <FormField>
                  <FieldLabel for="tagging-albumDialog-genres">
                    {t('tagging.albumDialog.genres')}
                  </FieldLabel>
                  <MetadataTagsInput
                    inputId="tagging-albumDialog-genres"
                    modelValue={props.draft.genres}
                    disabled={props.busy}
                    {...{
                      'onUpdate:modelValue': (genres: string[]) => update({ genres }),
                    }}
                  />
                </FormField>
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
