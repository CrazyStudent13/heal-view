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
      chunkSizeWarningLimit: 700
      // 这里刻意不手工划分 vendor 分块。
      //
      // 之前的 manualChunks 把 vant 归入 vendor-vant，但 Vue 规则只匹配
      // node_modules/vue，漏掉了 @vue/* 作用域包（@vue/shared、@vue/reactivity、
      // @vue/runtime-core、@vue/runtime-dom）。Rollup 于是把 Vue 运行时并进了
      // vendor-vant 分块，而入口需要 Vue 运行时，结果整个 Vant 分块（约 89 KB gzip
      // 的 JS + CSS）被挂到首屏静态依赖上——Vant 本来只服务 /m 移动端。
      //
      // 交给 Rollup 按真实静态/动态依赖图切分后，Vant 恢复按需加载，echarts 仍是
      // 独立的懒加载分块，首屏 gzip 从 379 KB 降到 322 KB。
      // 已实测：只给 manualChunks 补 @vue/ 规则无效（Rollup 仍会合并），
      // onlyExplicitManualChunks 也无效，所以直接不手工分块。
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
