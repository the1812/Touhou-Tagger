import { defineComponent, type PropType, reactive, watch } from 'vue'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { Save } from 'lucide-vue-next'

import type { PlanItemPreview, TrackMetadataPatch } from '../../api'

import './MetadataDrawer.css'

export const MetadataDrawer = defineComponent({
  name: 'MetadataDrawer',
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
      artists: '',
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
        draft.artists = item.artists.join(' / ')
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
        artists: draft.artists
          .split('/')
          .map(artist => artist.trim())
          .filter(Boolean),
        comments: draft.comments,
      })
      emit('update:visible', false)
    }

    return () => (
      <Drawer
        visible={props.visible}
        {...{ 'onUpdate:visible': (value: boolean) => emit('update:visible', value) }}
        position="right"
        header="编辑曲目"
        class="metadata-drawer"
        style={{ width: 'min(460px, 96vw)' }}
      >
        {{
          default: () =>
            props.item && (
              <div class="metadata-form">
                <div class="source-file">
                  <span>本地文件</span>
                  <strong>{props.item.sourceName}</strong>
                </div>

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
                  <span>标题</span>
                  <InputText v-model={draft.title} fluid invalid={!draft.title.trim()} />
                  {!draft.title.trim() && <small class="field-error">标题不能为空。</small>}
                </label>

                <label>
                  <span>艺术家</span>
                  <InputText v-model={draft.artists} fluid />
                  <small>多个艺术家使用 “ / ” 分隔。</small>
                  {!draft.artists.trim() && (
                    <small class="field-warning">数据源未提供艺术家，将以空值继续写入。</small>
                  )}
                </label>

                <label>
                  <span>注释</span>
                  <Textarea v-model={draft.comments} rows={6} fluid />
                </label>

                {props.item.issues.length > 0 && (
                  <div class="drawer-issues">
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
            <div class="drawer-footer">
              <Button
                label="取消"
                severity="secondary"
                text
                onClick={() => emit('update:visible', false)}
              />
              <Button
                label="保存并重新检查"
                disabled={!draft.title.trim()}
                onClick={save}
              >
                {{ icon: () => <Save size={17} /> }}
              </Button>
            </div>
          ),
        }}
      </Drawer>
    )
  },
})
