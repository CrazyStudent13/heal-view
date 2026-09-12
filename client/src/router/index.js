import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';

const loadDashboardPage = () => import('../pages/DashboardPage.vue');
const loadImportPage = () => import('../pages/ImportPage.vue');
const loadPlansPage = () => import('../pages/PlansPage.vue');
const loadReportsPage = () => import('../pages/ReportsPage.vue');
const loadProfilePage = () => import('../pages/ProfilePage.vue');
const loadProfileAccessPage = () => import('../pages/ProfileAccessPage.vue');
const loadProfilePlaceholderPage = () => import('../pages/ProfilePlaceholderPage.vue');
const loadLoginPage = () => import('../pages/LoginPage.vue');

const routes = [
  {
    path: '/login',
    name: 'login',
    component: loadLoginPage,
    meta: { title: '访问验证', public: true }
  },
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: loadDashboardPage,
    meta: { title: '健康看板' }
  },
  {
    path: '/import',
    name: 'import',
    component: loadImportPage,
    meta: { title: '数据导入' }
  },
  {
    path: '/plans',
    name: 'plans',
    component: loadPlansPage,
    meta: { title: '运动计划' }
  },
  {
    path: '/reports',
    redirect: '/reports/weekly'
  },
  {
    path: '/reports/:period(weekly|monthly)',
    name: 'reports',
    component: loadReportsPage,
    props: true,
    meta: { title: '周报月报' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: loadProfilePage,
    redirect: '/profile/access',
    meta: { title: '个人配置' },
    children: [
      {
        path: 'access',
        name: 'profile-access',
        component: loadProfileAccessPage,
        meta: {
          title: '访问保护',
          titleKey: 'profile.access',
          descriptionKey: 'auth.accessProtectionDescription'
        }
      },
      {
        path: 'about',
        name: 'profile-about',
        component: loadProfilePlaceholderPage,
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

const AUTH_STATUS_TTL = 30_000;
let authStatusPromise = null;
let authStatusCache = null;

function authStatusChangedSinceLastCheck(auth) {
  return !authStatusCache
    || auth.authenticated !== authStatusCache.authenticated
    || auth.enabled !== authStatusCache.enabled;
}

async function ensureAuthStatus(auth) {
  const cacheIsFresh = authStatusCache
    && Date.now() - authStatusCache.checkedAt < AUTH_STATUS_TTL;

  if (cacheIsFresh && !authStatusChangedSinceLastCheck(auth)) {
    return authStatusCache.response;
  }

  if (!authStatusPromise) {
    authStatusPromise = auth.fetchStatus()
      .then((response) => {
        authStatusCache = {
          authenticated: auth.authenticated,
          enabled: auth.enabled,
          checkedAt: Date.now(),
          response
        };
        return response;
      })
      .finally(() => {
        authStatusPromise = null;
      });
  }

  return authStatusPromise;
}

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  const auth = useAuthStore();
  try {
    const status = await ensureAuthStatus(auth);
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
