import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './styles/index.scss'
import App from './App.vue'
import { router } from './router'
import SectionTitle from './components/common/SectionTitle.vue'
import { getElementPlusLocale, i18n, normalizeLocale } from './i18n'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.component('SectionTitle', SectionTitle)

app.use(pinia)
app.use(i18n)
app.use(router)

window.addEventListener('heal-view-auth-required', () => {
  const auth = useAuthStore(pinia)
  auth.authenticated = false
  if (router.currentRoute.value.name !== 'login') {
    router.push({
      name: 'login',
      query: { redirect: router.currentRoute.value.fullPath }
    })
  }
})

const defaultLocale = normalizeLocale(localStorage.getItem('locale') || navigator.language)

app.use(ElementPlus, {
  locale: getElementPlusLocale(defaultLocale)
})

app.mount('#app')
