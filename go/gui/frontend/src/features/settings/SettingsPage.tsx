import { computed, defineComponent, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave } from 'vue-router'
import { Form } from '@primevue/forms'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { RotateCcw, Save } from 'lucide-vue-next'

import { useSettingsStore } from '../../stores/settings'

import './SettingsPage.css'

export const SettingsPage = defineComponent({
  name: 'SettingsPage',
  setup() {
    const settingsStore = useSettingsStore()
    const { draft, capabilities, loading, saving, dirty, errors, valid } =
      storeToRefs(settingsStore)
    const confirm = useConfirm()
    const searchableSources = computed(() =>
      capabilities.value?.sources.filter(option => option.supportsSearch),
    )
    const lyricDestination = computed({
      get: () => {
        if (!draft.value?.writeLyricsMetadata && !draft.value?.writeLrcFiles) {
          return 'none'
        }
        return draft.value.writeLrcFiles ? 'lrc' : 'metadata'
      },
      set: (value: string) => {
        if (!draft.value) {
          return
        }
        draft.value.writeLyricsMetadata = value === 'metadata'
        draft.value.writeLrcFiles = value === 'lrc'
      },
    })

    onMounted(() => void settingsStore.load())

    onBeforeRouteLeave(() => {
      if (!dirty.value) {
        return true
      }

      return new Promise<boolean>(resolve => {
        confirm.require({
          group: 'settings-leave',
          header: '放弃未保存的设置？',
          message: '离开此页面将丢弃当前修改。',
          acceptLabel: '放弃并离开',
          rejectLabel: '继续编辑',
          accept: () => {
            settingsStore.discard()
            resolve(true)
          },
          reject: () => resolve(false),
        })
      })
    })

    const confirmReset = () => {
      confirm.require({
        group: 'settings-reset',
        header: '恢复默认设置？',
        message: '当前配置会被默认值替换并立即保存。',
        acceptLabel: '恢复默认设置',
        rejectLabel: '取消',
        accept: settingsStore.reset,
      })
    }

    return () => {
      const currentDraft = draft.value
      return (
        <div class="settings-page">
          {loading.value || !currentDraft ? (
            <div class="settings-loading">
              <Skeleton height="10rem" />
              <Skeleton height="8rem" />
              <Skeleton height="12rem" />
            </div>
          ) : (
            <Form
              class="settings-form"
              {...{ onSubmit: () => void settingsStore.save() }}
            >
              <div class="settings-sections">
                <section class="settings-section">
                  <h2>常规</h2>
                  <div class="settings-grid">
                    <label class="field">
                      <span>默认数据源</span>
                      <Select
                        v-model={currentDraft.defaultSource}
                        options={searchableSources.value}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                      {errors.value.defaultSource && (
                        <small class="field-error">{errors.value.defaultSource}</small>
                      )}
                    </label>
                    <label class="field">
                      <span>注释语言</span>
                      <Select
                        v-model={currentDraft.commentLanguage}
                        options={capabilities.value?.commentLanguages}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                    </label>
                    <label class="field settings-grid__wide">
                      <span>MP3 多值分隔符</span>
                      <InputText
                        v-model={currentDraft.mp3MultiValueSeparator}
                        invalid={Boolean(errors.value.mp3MultiValueSeparator)}
                        size="small"
                        fluid
                      />
                      {errors.value.mp3MultiValueSeparator ? (
                        <small class="field-error">{errors.value.mp3MultiValueSeparator}</small>
                      ) : (
                        <small>用于把多个艺术家、风格等值写入一个 MP3 文本字段。</small>
                      )}
                    </label>
                    <label class="field">
                      <span>请求超时（秒）</span>
                      <InputNumber
                        v-model={currentDraft.requestTimeoutSeconds}
                        min={1}
                        max={300}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.requestTimeoutSeconds)}
                      />
                      {errors.value.requestTimeoutSeconds && (
                        <small class="field-error">{errors.value.requestTimeoutSeconds}</small>
                      )}
                    </label>
                    <label class="field">
                      <span>重试次数</span>
                      <InputNumber
                        v-model={currentDraft.retryCount}
                        min={1}
                        max={10}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.retryCount)}
                      />
                      {errors.value.retryCount && (
                        <small class="field-error">{errors.value.retryCount}</small>
                      )}
                    </label>
                  </div>
                </section>

                <section class="settings-section">
                  <h2>封面</h2>
                  <div class="settings-grid">
                    <label class="field">
                      <span>压缩阈值（KB）</span>
                      <InputNumber
                        v-model={currentDraft.coverCompressionThresholdKb}
                        min={0}
                        max={102400}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.coverCompressionThresholdKb)}
                      />
                      {errors.value.coverCompressionThresholdKb && (
                        <small class="field-error">
                          {errors.value.coverCompressionThresholdKb}
                        </small>
                      )}
                    </label>
                    <label class="field">
                      <span>最大边长（像素）</span>
                      <InputNumber
                        v-model={currentDraft.coverMaxEdge}
                        min={0}
                        max={8192}
                        step={128}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.coverMaxEdge)}
                      />
                      {errors.value.coverMaxEdge && (
                        <small class="field-error">{errors.value.coverMaxEdge}</small>
                      )}
                    </label>
                  </div>
                </section>

                <section class="settings-section">
                  <h2>歌词</h2>
                  <div class="settings-grid">
                    <label class="field">
                      <span>歌词类型</span>
                      <Select
                        v-model={currentDraft.lyricType}
                        options={capabilities.value?.lyricTypes}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                      />
                    </label>
                    <fieldset class="field output-field">
                      <legend>输出位置</legend>
                      {[
                        ['none', '不写入歌词'],
                        ['metadata', '写入音频 metadata'],
                        ['lrc', '生成独立 LRC 文件'],
                      ].map(([value, label]) => (
                        <label key={value}>
                          <RadioButton
                            v-model={lyricDestination.value}
                            inputId={`lyrics-${value}`}
                            value={value}
                            size="small"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                      {errors.value.lyricDestination && (
                        <small class="field-error">{errors.value.lyricDestination}</small>
                      )}
                    </fieldset>
                    <label class="field settings-grid__wide">
                      <span>混合歌词分隔符</span>
                      <InputText
                        v-model={currentDraft.mixedLyricSeparator}
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                        invalid={Boolean(errors.value.mixedLyricSeparator)}
                      />
                      {errors.value.mixedLyricSeparator && (
                        <small class="field-error">{errors.value.mixedLyricSeparator}</small>
                      )}
                    </label>
                    <label class="switch-field">
                      <span>
                        <strong>保留歌词时间轴</strong>
                        <small>保留现有时间标记，供 metadata 或 LRC 输出使用。</small>
                      </span>
                      <ToggleSwitch
                        v-model={currentDraft.preserveLyricTimeline}
                        disabled={lyricDestination.value === 'none'}
                      />
                    </label>
                    <label class="field">
                      <span>歌词缓存数量</span>
                      <InputNumber
                        v-model={currentDraft.lyricCacheSize}
                        min={1}
                        max={10000}
                        showButtons
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                        invalid={Boolean(errors.value.lyricCacheSize)}
                      />
                      {errors.value.lyricCacheSize && (
                        <small class="field-error">{errors.value.lyricCacheSize}</small>
                      )}
                    </label>
                  </div>
                </section>
              </div>

              <footer class="settings-action-bar">
                <div>
                  <strong>{dirty.value ? '有未保存的修改' : '所有设置已保存'}</strong>
                  <span>
                    {!valid.value ? '请修复页面中的字段错误。' : '设置由 Go 写入现有配置文件。'}
                  </span>
                </div>
                <div>
                  <Button
                    label="恢复默认设置"
                    type="button"
                    size="small"
                    severity="secondary"
                    text
                    disabled={saving.value}
                    onClick={confirmReset}
                  >
                    {{ icon: () => <RotateCcw size={15} /> }}
                  </Button>
                  <Button
                    label="保存设置"
                    type="submit"
                    size="small"
                    loading={saving.value}
                    disabled={!dirty.value || !valid.value}
                  >
                    {{ icon: () => <Save size={16} /> }}
                  </Button>
                </div>
              </footer>
            </Form>
          )}

          <ConfirmDialog group="settings-leave" />
          <ConfirmDialog group="settings-reset" />
        </div>
      )
    }
  },
})
