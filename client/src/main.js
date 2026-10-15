import { createApp } from 'vue';
import { createPinia } from 'pinia';
// 组件不再在 main.js 里全量 import + 全局注册：模板里出现的 <el-*> 由
// vite.config.js 的 ElementPlusResolver 按需引入（组件与样式一起），
// 这样 ElTable 等只在个别页面用到的组件不会再被挂进首屏。
// 只有下面这个指令必须显式注册，resolver 不接管 app.directive 的注册时机。
import { vLoading } from 'element-plus';
// 全量样式（element-plus/dist/index.css，376 KB）已移除，改由 resolver 按需注入；
// 命令式 API、指令与显式 import 的组件样式在 element-plus-on-demand.js 里补齐。
// 暗黑模式变量是全局令牌，仍然整包引入。
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@/styles/element-plus-on-demand.js';
import '@/styles/index.scss';
import App from '@/App.vue';
import { router } from '@/router';
import SectionTitle from '@/components/ui/SectionTitle.vue';
import { i18n } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';

const app = createApp(App);
const pinia = createPinia();

app.component('SectionTitle', SectionTitle);

app.use(pinia);
app.use(i18n);
app.use(router);

app.directive('loading', vLoading);

window.addEventListener('heal-view-auth-required', () => {
  const auth = useAuthStore(pinia);
  auth.authenticated = false;
  if (router.currentRoute.value.name !== 'login') {
    router.push({
      name: 'login',
      query: { redirect: router.currentRoute.value.fullPath }
    });
  }
});

app.mount('#app');
