import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { defineComponent, type PropType, reactive, watch } from 'vue'

import type { AlbumMetadata } from '../../api'
import { t } from '../../i18n'
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
      () => props.album,
      album => {
        if (!album) {
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
              <label
                class={[
                  'grid gap-1.5 text-app-control font-semibold',
                  '[&>small]:text-xs [&>small]:font-normal',
                ]}
              >
                <span>{t('tagging.albumDialog.title')}</span>
                <InputText v-model={draft.title} fluid invalid={!draft.title.trim()} />
              </label>
              <div class="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                <label
                  class={[
                    'grid gap-1.5 text-app-control font-semibold',
                    '[&>small]:text-xs [&>small]:font-normal',
                  ]}
                >
                  <span>{t('tagging.albumDialog.catalogNumber')}</span>
                  <InputText v-model={draft.albumOrder} fluid />
                </label>
                <label
                  class={[
                    'grid gap-1.5 text-app-control font-semibold',
                    '[&>small]:text-xs [&>small]:font-normal',
                  ]}
                >
                  <span>{t('tagging.albumDialog.year')}</span>
                  <InputText v-model={draft.year} fluid />
                </label>
              </div>
              <label
                class={[
                  'grid gap-1.5 text-app-control font-semibold',
                  '[&>small]:text-xs [&>small]:font-normal',
                ]}
              >
                <span>{t('tagging.albumDialog.circles')}</span>
                <MetadataTagsInput
                  modelValue={draft.artists}
                  {...{
                    'onUpdate:modelValue': (values: string[]) => {
                      draft.artists = values
                    },
                  }}
                />
              </label>
              <label
                class={[
                  'grid gap-1.5 text-app-control font-semibold',
                  '[&>small]:text-xs [&>small]:font-normal',
                ]}
              >
                <span>{t('tagging.albumDialog.genres')}</span>
                <MetadataTagsInput
                  modelValue={draft.genres}
                  {...{
                    'onUpdate:modelValue': (values: string[]) => {
                      draft.genres = values
                    },
                  }}
                />
              </label>
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
