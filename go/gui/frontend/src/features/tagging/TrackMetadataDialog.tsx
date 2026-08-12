import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { defineComponent, type PropType, reactive, watch } from 'vue'

import type { PlanItemPreview } from '../../api'
import { MetadataTagsInput } from './MetadataTagsInput'

const fieldClass =
  'grid gap-1.5 text-[.82rem] font-semibold [&>small]:text-xs [&>small]:font-normal'

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
        header="编辑曲目信息"
        class="w-[min(560px,calc(100vw-2rem))]"
      >
        {{
          default: () =>
            props.item && (
              <div class="grid gap-3.5">
                <div class="grid min-w-0 gap-1">
                  <span class="text-xs text-muted-color">本地文件</span>
                  <strong
                    class="overflow-hidden text-ellipsis whitespace-nowrap text-[.82rem]"
                    title={props.item.sourceName}
                  >
                    {props.item.sourceName}
                  </strong>
                </div>

                <label class={fieldClass}>
                  <span>标题</span>
                  <InputText v-model={draft.title} fluid invalid={!draft.title.trim()} />
                  {!draft.title.trim() && (
                    <small class="text-red-700 dark:text-red-300">标题不能为空。</small>
                  )}
                </label>

                <label class={fieldClass}>
                  <span>艺术家</span>
                  <MetadataTagsInput
                    modelValue={draft.artists}
                    {...{
                      'onUpdate:modelValue': (values: string[]) => {
                        draft.artists = values
                      },
                    }}
                  />
                  {draft.artists.length === 0 && (
                    <small class="text-amber-700 dark:text-amber-300">
                      数据源未提供艺术家，将以空值继续写入。
                    </small>
                  )}
                </label>

                <div class="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                  <label class={fieldClass}>
                    <span>碟号</span>
                    <InputText v-model={draft.discNumber} fluid />
                  </label>
                  <label class={fieldClass}>
                    <span>轨号</span>
                    <InputText v-model={draft.trackNumber} fluid />
                  </label>
                </div>

                <label class={fieldClass}>
                  <span>注释</span>
                  <Textarea v-model={draft.comments} rows={6} fluid />
                </label>

                {props.item.issues.length > 0 && (
                  <div class="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 dark:border-amber-700 dark:bg-amber-950/50">
                    <strong>当前问题</strong>
                    <ul class="mb-0 mt-1.5 pl-4">
                      {props.item.issues.map(issue => (
                        <li key={issue.code}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
