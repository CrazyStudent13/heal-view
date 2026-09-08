import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../pages/DashboardPage.vue';
import ImportPage from '../pages/ImportPage.vue';
import PlansPage from '../pages/PlansPage.vue';
import ReportsPage from '../pages/ReportsPage.vue';
import ProfilePage from '../pages/ProfilePage.vue';

const routes = [
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
    meta: { title: '个人配置' }
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Heal View` : 'Heal View';
});
