import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './style.css'
import App from './App.vue'
import SectionTitle from './components/common/SectionTitle.vue'
import { getElementPlusLocale, i18n, normalizeLocale } from './i18n'

const app = createApp(App)
const pinia = createPinia()

// Register all icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.component('SectionTitle', SectionTitle)

app.use(pinia)
app.use(i18n)

// Configure Element Plus with locale
const defaultLocale = normalizeLocale(localStorage.getItem('locale') || navigator.language)

app.use(ElementPlus, {
  locale: getElementPlusLocale(defaultLocale)
})

app.mount('#app')
