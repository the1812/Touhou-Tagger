import { defaultKeymap } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const previewTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--p-content-background)',
    color: 'var(--p-text-color)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    overscrollBehavior: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
  },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { backgroundColor: 'var(--p-content-background)', border: 'none' },
  '&.cm-focused': { outline: 'none' },
})

export const DumpPreview = defineComponent({
  name: 'DumpPreview',
  props: {
    value: { type: String, required: true },
  },
  setup(props) {
    const container = ref<HTMLDivElement>()
    const theme = new Compartment()
    const currentTheme = () =>
      document.documentElement.classList.contains('app-dark') ? oneDark : []
    let instance: EditorView | undefined
    const themeObserver = new MutationObserver(() => {
      instance?.dispatch({ effects: theme.reconfigure(currentTheme()) })
    })
    onMounted(() => {
      instance = new EditorView({
        parent: container.value,
        doc: props.value,
        extensions: [
          EditorState.readOnly.of(true),
          EditorState.tabSize.of(2),
          lineNumbers(),
          foldGutter(),
          drawSelection(),
          bracketMatching(),
          highlightSelectionMatches(),
          search({ top: true }),
          keymap.of([...defaultKeymap, ...searchKeymap, ...foldKeymap]),
          json(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          previewTheme,
          theme.of(currentTheme()),
        ],
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
    })
    watch(
      () => props.value,
      value => {
        instance?.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value } })
      },
    )
    onBeforeUnmount(() => {
      themeObserver.disconnect()
      instance?.destroy()
    })
    return () => <div ref={container} class="min-h-0 min-w-0 flex-1 overflow-hidden" />
  },
})
