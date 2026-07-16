import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { hasPermi, hasRole } from './directives/permission'
import { initDeviceDetection } from './utils/device'

import 'element-plus/dist/index.css'
import './assets/styles/global.css'

initDeviceDetection()

const app = createApp(App)

// 注册 Pinia
app.use(createPinia())

// 注册路由
app.use(router)

// 注册 Element Plus（中文）
app.use(ElementPlus, { locale: zhCn })

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 注册权限指令
app.directive('hasPermi', hasPermi)
app.directive('hasRole', hasRole)

app.mount('#app')
