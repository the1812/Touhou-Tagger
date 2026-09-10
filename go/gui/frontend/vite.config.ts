import tailwindcss from '@tailwindcss/vite'
import fmtConfig from '@the1812/oxc-config/oxfmt'
import lintConfig from '@the1812/oxc-config/oxlint'
import vueJsx from '@vitejs/plugin-vue-jsx'
import wails from '@wailsio/runtime/plugins/vite'
import { defineConfig, lazyPlugins } from 'vite-plus'

export default defineConfig({
  fmt: {
    ...fmtConfig,
    ignorePatterns: [...(fmtConfig.ignorePatterns ?? []), 'bindings/', 'embed/'],
  },
  lint: {
    extends: [lintConfig],
    categories: { correctness: 'off' },
    plugins: ['vue'],
    env: { browser: true },
    ignorePatterns: ['node_modules/', 'bindings/', 'embed/'],
    options: { typeAware: true, typeCheck: true },
  },
  build: {
    outDir: 'embed/dist',
  },
  plugins: lazyPlugins(() => [tailwindcss(), vueJsx(), wails('./bindings')]),
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
})
