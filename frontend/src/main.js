import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import './style.css'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Register all icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)

// Configure Element Plus with locale
const defaultLocale = localStorage.getItem('locale') || 'zh-CN'
const localeMap = {
  'zh-CN': zhCn,
  'en': en
}

app.use(ElementPlus, {
  locale: localeMap[defaultLocale] || zhCn
})

app.mount('#app')
