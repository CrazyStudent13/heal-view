import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElConfigProvider,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElOption,
  ElPopconfirm,
  ElRadioButton,
  ElRadioGroup,
  ElSegmented,
  ElSelect,
  ElSkeleton,
  ElSkeletonItem,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElText,
  ElTooltip,
  ElUpload
} from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/index.scss'
import App from './App.vue'
import { router } from './router'
import SectionTitle from './components/common/SectionTitle.vue'
import { i18n } from './i18n'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)
const pinia = createPinia()

app.component('SectionTitle', SectionTitle)

app.use(pinia)
app.use(i18n)
app.use(router)

const elementComponents = [
  ElAlert,
  ElButton,
  ElCard,
  ElConfigProvider,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElOption,
  ElPopconfirm,
  ElRadioButton,
  ElRadioGroup,
  ElSegmented,
  ElSelect,
  ElSkeleton,
  ElSkeletonItem,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElText,
  ElTooltip,
  ElUpload
]

elementComponents
  .filter(Boolean)
  .forEach(component => app.component(component.name, component))

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

app.mount('#app')
