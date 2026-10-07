import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore.js';
import { translate } from '@/i18n/index.js';
import AppLayout from '@/components/layout/AppLayout.vue';
import MobileLayout from '@/pages/mobile/MobileLayout.vue';

const loadDashboardPage = () => import('@/pages/dashboard/DashboardPage.vue');
const loadImportPage = () => import('@/pages/import/ImportPage.vue');
const loadProfilePage = () => import('@/pages/profile/ProfilePage.vue');
const loadProfileAccessPage = () => import('@/pages/profile/ProfileAccessPage.vue');
const loadProfilePlaceholderPage = () => import('@/pages/profile/ProfileAboutPage.vue');
const loadLoginPage = () => import('@/pages/LoginPage.vue');
const loadPlanLayoutPage = () => import('@/pages/plans/PlanLayoutPage.vue');
const loadPlanOverviewPage = () => import('@/pages/plans/PlanOverviewPage.vue');
const loadPlanSessionsPage = () => import('@/pages/plans/PlanSessionsPage.vue');
const loadPlanExercisesPage = () => import('@/pages/PlansPage.vue');
const loadMobileTodayPage = () => import('@/pages/mobile/TrainingPage.vue');
const loadMobileSettingsPage = () => import('@/pages/mobile/MobileSettingsPage.vue');
const routes = [
  {
    path: '/login',
    name: 'login',
    component: loadLoginPage,
    meta: { titleKey: 'auth.title', public: true }
  },
  {
    // 桌面端外壳：本身不带路径，只负责给下面的页面提供统一的顶栏与内容区。
    // 移动端外壳在 /m 下自成一支，两套外壳在路由树里互斥，不会互相嵌套。
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: loadDashboardPage,
        meta: { titleKey: 'nav.dashboard' }
      },
      {
        path: 'import',
        name: 'import',
        component: loadImportPage,
        meta: { titleKey: 'nav.import' }
      },
      {
        path: 'plans',
        name: 'plans',
        component: loadPlanLayoutPage,
        redirect: '/plans/overview',
        meta: { titleKey: 'nav.plans' },
        children: [
          {
            path: 'overview',
            name: 'plans-overview',
            component: loadPlanOverviewPage,
            meta: { titleKey: 'plans.overview' }
          },
          {
            path: 'exercises',
            name: 'plans-exercises',
            component: loadPlanExercisesPage,
            meta: { titleKey: 'plans.exercise.title' }
          },
          {
            path: 'sessions',
            name: 'plans-sessions',
            component: loadPlanSessionsPage,
            meta: { titleKey: 'plans.sessions.title' }
          }
        ]
      },
      {
        path: 'profile',
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
    ]
  },
  {
    // 移动端外壳自成一支，后续 /m 下新增页面只需加子路由。
    path: '/m',
    component: MobileLayout,
    redirect: '/m/today',
    meta: { public: true },
    children: [
      {
        path: 'today',
        name: 'mobile-today',
        component: loadMobileTodayPage,
        meta: { titleKey: 'mobile.title', public: true }
      },
      {
        path: 'settings',
        name: 'mobile-settings',
        component: loadMobileSettingsPage,
        meta: { titleKey: 'settings.title', public: true }
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
  return (
    !authStatusCache || auth.authenticated !== authStatusCache.authenticated || auth.enabled !== authStatusCache.enabled
  );
}

async function ensureAuthStatus(auth) {
  const cacheIsFresh = authStatusCache && Date.now() - authStatusCache.checkedAt < AUTH_STATUS_TTL;

  if (cacheIsFresh && !authStatusChangedSinceLastCheck(auth)) {
    return authStatusCache.response;
  }

  if (!authStatusPromise) {
    authStatusPromise = auth
      .fetchStatus()
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
