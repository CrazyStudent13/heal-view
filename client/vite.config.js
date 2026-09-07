import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')
          if (normalizedId.includes('/zrender/')) {
            return 'vendor-zrender'
          }
          if (normalizedId.includes('node_modules/echarts')) {
            return 'vendor-echarts'
          }
          if (normalizedId.includes('node_modules/vue') || normalizedId.includes('node_modules/pinia') || normalizedId.includes('node_modules/vue-i18n')) {
            return 'vendor-vue'
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
