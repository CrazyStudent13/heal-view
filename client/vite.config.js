import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';

// Vant 只服务移动端（/m 路由），这里限定扫描范围，
// 让桌面端继续使用 Element Plus，两套组件库各自按需引入、互不干扰。
const MOBILE_ONLY = fileURLToPath(new URL('./src/pages/mobile', import.meta.url)).replaceAll('\\', '/');

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number.parseInt(env.CLIENT_PORT || '43127', 10);
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://localhost:43128';

  return {
    plugins: [
      vue(),
      Components({
        dts: false,
        include: [/src\/pages\/mobile\/.*\.vue$/],
        dirs: [],
        resolvers: [VantResolver()]
      })
    ],
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
            if (normalizedId.includes('node_modules/vant') || normalizedId.includes('@vant/')) {
              return 'vendor-vant';
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
