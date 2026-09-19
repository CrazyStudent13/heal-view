import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number.parseInt(env.CLIENT_PORT || '43127', 10);
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://localhost:43128';

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/');
            if (normalizedId.includes('/zrender/')) {
              return 'vendor-zrender';
            }
            if (normalizedId.includes('node_modules/echarts')) {
              return 'vendor-echarts';
            }
            if (
              normalizedId.includes('node_modules/vue') ||
              normalizedId.includes('node_modules/pinia') ||
              normalizedId.includes('node_modules/vue-i18n')
            ) {
              return 'vendor-vue';
            }
          }
        }
      }
    },
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      port,
      strictPort: true
    }
  };
});
