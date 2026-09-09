import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../pages/DashboardPage.vue';
import ImportPage from '../pages/ImportPage.vue';
import PlansPage from '../pages/PlansPage.vue';
import ReportsPage from '../pages/ReportsPage.vue';
import ProfilePage from '../pages/ProfilePage.vue';
import ProfileAccessPage from '../pages/ProfileAccessPage.vue';
import ProfilePlaceholderPage from '../pages/ProfilePlaceholderPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import { useAuthStore } from '../stores/authStore.js';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: '访问验证', public: true }
  },
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardPage,
    meta: { title: '健康看板' }
  },
  {
    path: '/import',
    name: 'import',
    component: ImportPage,
    meta: { title: '数据导入' }
  },
  {
    path: '/plans',
    name: 'plans',
    component: PlansPage,
    meta: { title: '运动计划' }
  },
  {
    path: '/reports',
    redirect: '/reports/weekly'
  },
  {
    path: '/reports/:period(weekly|monthly)',
    name: 'reports',
    component: ReportsPage,
    props: true,
    meta: { title: '周报月报' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    redirect: '/profile/access',
    meta: { title: '个人配置' },
    children: [
      {
        path: 'access',
        name: 'profile-access',
        component: ProfileAccessPage,
        meta: {
          title: '访问保护',
          titleKey: 'profile.access',
          descriptionKey: 'auth.accessProtectionDescription'
        }
      },
      {
        path: 'about',
        name: 'profile-about',
        component: ProfilePlaceholderPage,
        meta: {
          title: '关于与运行信息',
          titleKey: 'profile.about',
          descriptionKey: 'profile.aboutDescription'
        }
      }
    ]
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  const auth = useAuthStore();
  try {
    const status = await auth.fetchStatus();
    if (status.enabled && !status.authenticated) {
      return {
        name: 'login',
        query: { redirect: to.fullPath }
      };
    }
  } catch {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    };
  }

  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Heal View` : 'Heal View';
});
