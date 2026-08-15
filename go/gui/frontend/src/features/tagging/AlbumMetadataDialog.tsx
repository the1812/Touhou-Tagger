import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { defineComponent, type PropType, reactive, watch } from 'vue'

import type { AlbumMetadata } from '../../api'
import { MetadataTagsInput } from './MetadataTagsInput'

const fieldClass =
  'grid gap-1.5 text-[.82rem] font-semibold [&>small]:text-xs [&>small]:font-normal'

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
        header="编辑专辑信息"
        class="w-[min(560px,calc(100vw-2rem))]"
      >
        {{
          default: () => (
            <div class="grid gap-3.5">
              <label class={fieldClass}>
                <span>专辑名称</span>
                <InputText v-model={draft.title} fluid invalid={!draft.title.trim()} />
              </label>
              <div class="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                <label class={fieldClass}>
                  <span>发行编号</span>
                  <InputText v-model={draft.albumOrder} fluid />
                </label>
                <label class={fieldClass}>
                  <span>年份</span>
                  <InputText v-model={draft.year} fluid />
                </label>
              </div>
              <label class={fieldClass}>
                <span>社团</span>
                <MetadataTagsInput
                  modelValue={draft.artists}
                  {...{
                    'onUpdate:modelValue': (values: string[]) => {
                      draft.artists = values
                    },
                  }}
                />
              </label>
              <label class={fieldClass}>
                <span>风格</span>
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
                label="取消"
                severity="secondary"
                text
                onClick={() => emit('update:visible', false)}
              />
              <Button label="保存" disabled={!draft.title.trim()} onClick={save} />
            </>
          ),
        }}
      </Dialog>
    )
  },
})
