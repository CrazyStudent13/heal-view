import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';
import { translate } from '../i18n/index.js';

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
    meta: { titleKey: 'auth.title', public: true }
  },
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: loadDashboardPage,
    meta: { titleKey: 'nav.dashboard' }
  },
  {
    path: '/import',
    name: 'import',
    component: loadImportPage,
    meta: { titleKey: 'nav.import' }
  },
  {
    path: '/plans',
    name: 'plans',
    component: loadPlansPage,
    meta: { titleKey: 'plans.title' }
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
    meta: { titleKey: 'reports.title' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: loadProfilePage,
    redirect: '/profile/access',
    meta: { titleKey: 'profile.title' },
    children: [
      {
        path: 'access',
        name: 'profile-access',
        component: loadProfileAccessPage,
        meta: {
          titleKey: 'profile.access',
          descriptionKey: 'auth.accessProtectionDescription'
        }
      },
      {
        path: 'about',
        name: 'profile-about',
        component: loadProfilePlaceholderPage,
        meta: {
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
  const title = to.meta.titleKey ? translate(to.meta.titleKey) : 'Heal View';
  document.title = title ? `${title} · Heal View` : 'Heal View';
});
