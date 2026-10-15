import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

// Vant 只服务移动端（/m 路由），桌面端继续使用 Element Plus。
const MOBILE_ONLY = fileURLToPath(new URL('./src/pages/mobile', import.meta.url)).replaceAll('\\', '/');

const VANT_SCOPE_ERROR = 'Vant 只允许在 src/pages/mobile/ 下使用';

function normalizeId(id) {
  return String(id).replaceAll('\\', '/');
}

/** 去掉 ?vue&type=script 之类的查询串后再判断，否则 .vue 的子请求会漏判。 */
function withoutQuery(id) {
  return normalizeId(id).split('?')[0];
}

function isVantOwnFile(id) {
  const normalized = normalizeId(id);
  return normalized.includes('/node_modules/vant/') || normalized.includes('/node_modules/@vant/');
}

function isMobileFile(id) {
  return withoutQuery(id).includes(`${MOBILE_ONLY}/`);
}

function importsVant(source) {
  return /(?:from\s*|import\s*)['"]vant(?:\/[^'"]*)?['"]/.test(source);
}

/**
 * 「Vant 只作用于移动端」的硬性护栏。
 *
 * 为什么不能继续用 unplugin-vue-components 的 include 表达：
 * 加进 Element Plus 之后，桌面端也要靠 resolver 自动引入，而该插件的 include/exclude 是
 * 全局的、无法按 resolver 分别限定；VantResolver 的 resolve 又只收到组件名、拿不到文件路径
 * （见 @vant/auto-import-resolver 的 `resolve: (name) => ...`），没法用 filename 包一层。
 *
 * 这个护栏守的是 P1 的收益：Vant 一旦被桌面端静态引用，Rollup 会把整个 Vant
 *（约 89 KB gzip 的 JS + CSS）重新挂回首屏。两道检查：
 *   - transform：拦住源码里显式写的 `from 'vant'`；
 *   - resolveId：拦住 resolver 注入的 `from 'vant'`（transform 钩子只看得到原始源码，
 *     注入发生在后面，所以必须靠 resolveId 拿 importer 判断）。
 */
function enforceVantScope() {
  const reject = (offender, what) => {
    throw new Error(`${VANT_SCOPE_ERROR}，但 ${offender} 引入了 ${what}。请把该组件放到 src/pages/mobile/ 下。`);
  };

  return {
    name: 'heal-view:enforce-vant-scope',
    enforce: 'pre',
    transform(source, id) {
      if (!importsVant(source)) return null;
      if (isVantOwnFile(id) || isMobileFile(id)) return null;
      reject(normalizeId(id), 'vant');
      return null;
    },
    resolveId(source, importer) {
      if (!importer || !/^vant(?:\/|$)/.test(source)) return null;
      if (isVantOwnFile(importer) || isMobileFile(importer)) return null;
      reject(normalizeId(importer), source);
      return null;
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number.parseInt(env.CLIENT_PORT || '43127', 10);
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://localhost:43128';

  return {
    plugins: [
      vue(),
      enforceVantScope(),
      Components({
        dts: false,
        dirs: [],
        // 两套组件库都按需引入：Vant 只服务 /m 移动端，Element Plus 服务桌面端。
        // 这里不再用 include 限定扫描范围（会连 Element Plus 一起挡掉），Vant 的范围
        // 由上面的 enforceVantScope 护栏保证。
        resolvers: [VantResolver(), ElementPlusResolver()]
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
