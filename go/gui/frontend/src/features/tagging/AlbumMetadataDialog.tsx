import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { defineComponent, type PropType, reactive, watch } from 'vue'

import type { AlbumMetadata } from '../../api'
import { t } from '../../i18n'
import { FieldLabel, FormField } from '../../shared/FormField'
import { MetadataTagsInput } from './MetadataTagsInput'

export const AlbumMetadataDialog = defineComponent({
  name: 'AlbumMetadataDialog',
  props: {
    visible: Boolean,
    album: Object as PropType<AlbumMetadata>,
  },
  emits: {
    'update:visible': null,
    save: null,
  },
  setup(props, { emit }) {
    const draft = reactive({
      title: '',
      albumOrder: '',
      artists: [] as string[],
      year: '',
      genres: [] as string[],
    })

    watch(
      [() => props.visible, () => props.album],
      ([visible, album]) => {
        if (!visible || !album) {
          return
        }
        draft.title = album.title
        draft.albumOrder = album.albumOrder
        draft.artists = [...album.artists]
        draft.year = album.year
        draft.genres = [...album.genres]
      },
      { immediate: true },
    )

    const save = () => {
      emit('save', {
        title: draft.title.trim(),
        albumOrder: draft.albumOrder.trim(),
        artists: draft.artists,
        year: draft.year.trim(),
        genres: draft.genres,
      })
      emit('update:visible', false)
    }

    return () => (
      <Dialog
        visible={props.visible}
        {...{
          'onUpdate:visible': (value: boolean) => emit('update:visible', value),
        }}
        modal
        header={t('tagging.albumDialog.header')}
        class="w-[min(560px,calc(100vw-2rem))]"
      >
        {{
          default: () => (
            <div class="grid gap-3.5">
              <FormField>
                <FieldLabel for="tagging-albumDialog-title">
                  {t('tagging.albumDialog.title')}
                </FieldLabel>
                <InputText
                  id="tagging-albumDialog-title"
                  v-model={draft.title}
                  autofocus
                  fluid
                  invalid={!draft.title.trim()}
                />
              </FormField>
              <div class="grid grid-cols-2 gap-3">
                <FormField>
                  <FieldLabel for="tagging-albumDialog-catalogNumber">
                    {t('tagging.albumDialog.catalogNumber')}
                  </FieldLabel>
                  <InputText
                    id="tagging-albumDialog-catalogNumber"
                    v-model={draft.albumOrder}
                    fluid
                  />
                </FormField>
                <FormField>
                  <FieldLabel for="tagging-albumDialog-year">
                    {t('tagging.albumDialog.year')}
                  </FieldLabel>
                  <InputText id="tagging-albumDialog-year" v-model={draft.year} fluid />
                </FormField>
              </div>
              <FormField>
                <FieldLabel for="tagging-albumDialog-circles">
                  {t('tagging.albumDialog.circles')}
                </FieldLabel>
                <MetadataTagsInput
                  inputId="tagging-albumDialog-circles"
                  modelValue={draft.artists}
                  {...{
                    'onUpdate:modelValue': (values: string[]) => {
                      draft.artists = values
                    },
                  }}
                />
              </FormField>
              <FormField>
                <FieldLabel for="tagging-albumDialog-genres">
                  {t('tagging.albumDialog.genres')}
                </FieldLabel>
                <MetadataTagsInput
                  inputId="tagging-albumDialog-genres"
                  modelValue={draft.genres}
                  {...{
                    'onUpdate:modelValue': (values: string[]) => {
                      draft.genres = values
                    },
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
