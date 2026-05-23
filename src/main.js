import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { hasPermi, hasRole } from './directives/permission'

import './assets/styles/global.css'

const app = createApp(App)

// 注册 Pinia
app.use(createPinia())

// 注册路由
app.use(router)

// 注册权限指令
app.directive('hasPermi', hasPermi)
app.directive('hasRole', hasRole)

app.mount('#app')
