import vue from '@vitejs/plugin-vue'
import wails from '@wailsio/runtime/plugins/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'embed/dist',
  },
  plugins: [vue(), wails('./bindings')],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
})
