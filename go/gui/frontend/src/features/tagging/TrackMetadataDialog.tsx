import { defineComponent, type PropType, reactive, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

import type { PlanItemPreview, TrackMetadataPatch } from '../../api'
import { MetadataTagsInput } from './MetadataTagsInput'

import './MetadataDialog.css'

export const TrackMetadataDialog = defineComponent({
  name: 'TrackMetadataDialog',
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    item: Object as PropType<PlanItemPreview>,
  },
  emits: {
    'update:visible': (_value: boolean) => true,
    save: (_patch: TrackMetadataPatch) => true,
  },
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
        class="metadata-dialog"
        style={{ width: 'min(560px, calc(100vw - 2rem))' }}
      >
        {{
          default: () =>
            props.item && (
              <div class="metadata-form">
                <div class="metadata-source">
                  <span>本地文件</span>
                  <strong title={props.item.sourceName}>{props.item.sourceName}</strong>
                </div>

                <label>
                  <span>标题</span>
                  <InputText v-model={draft.title} fluid invalid={!draft.title.trim()} />
                  {!draft.title.trim() && <small class="field-error">标题不能为空。</small>}
                </label>

                <label>
                  <span>艺术家</span>
                  <MetadataTagsInput
                    modelValue={draft.artists}
                    {...{
                      'onUpdate:modelValue': (values: string[]) => {
                        draft.artists = values
                      },
                    }}
                    ariaLabel="艺术家"
                  />
                  {draft.artists.length === 0 && (
                    <small class="field-warning">数据源未提供艺术家，将以空值继续写入。</small>
                  )}
                </label>

                <div class="metadata-form__row">
                  <label>
                    <span>碟号</span>
                    <InputText v-model={draft.discNumber} fluid />
                  </label>
                  <label>
                    <span>轨号</span>
                    <InputText v-model={draft.trackNumber} fluid />
                  </label>
                </div>

                <label>
                  <span>注释</span>
                  <Textarea v-model={draft.comments} rows={6} fluid />
                </label>

                {props.item.issues.length > 0 && (
                  <div class="metadata-issues">
                    <strong>当前问题</strong>
                    <ul>
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
