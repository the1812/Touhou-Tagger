import 'monaco-editor/features/register.all.js'
import { editor } from 'monaco-editor/editor/editor.api.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import 'monaco-editor/language/json/monaco.contribution.js'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'

globalThis.MonacoEnvironment = {
  getWorker: (_id, label) => (label === 'json' ? new JsonWorker() : new EditorWorker()),
}

export const DumpPreview = defineComponent({
  name: 'DumpPreview',
  props: {
    value: { type: String, required: true },
  },
  setup(props) {
    const container = ref<HTMLDivElement>()
    let instance: editor.IStandaloneCodeEditor | undefined
    const updateTheme = () => {
      editor.setTheme(document.documentElement.classList.contains('app-dark') ? 'vs-dark' : 'vs')
    }
    const themeObserver = new MutationObserver(updateTheme)
    onMounted(() => {
      instance = editor.create(container.value as HTMLDivElement, {
        value: props.value,
        language: 'json',
        readOnly: true,
        domReadOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        padding: { top: 12, bottom: 12 },
        contextmenu: false,
        renderLineHighlight: 'none',
      })
      updateTheme()
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
    })
    watch(
      () => props.value,
      value => instance?.setValue(value),
    )
    onBeforeUnmount(() => {
      themeObserver.disconnect()
      const model = instance?.getModel()
      instance?.dispose()
      model?.dispose()
    })
    return () => <div ref={container} class="min-h-0 flex-1 overflow-hidden" />
  },
})
