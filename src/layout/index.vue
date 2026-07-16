<template>
  <el-watermark :content="watermarkContent">
    <el-container class="layout-container" :class="{ 'mobile-layout': isMobileView }">
      <!-- 侧边栏 -->
      <el-aside
        :width="asideWidth"
        class="layout-aside"
        :class="{ 'is-mobile-open': mobileMenuOpen }"
      >
        <div class="logo-container">
          <img src="@/assets/project-logo.png" alt="Logo" class="logo-img" />
          <span v-show="!menuCollapsed" class="logo-text">中台工单流转系统</span>
        </div>
        <el-menu
        :default-active="activeMenu"
        :collapse="menuCollapsed"
        :unique-opened="true"
        router
        class="layout-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <SidebarMenu :menus="menuRoutes" :get-icon-component="getIconComponent" />
      </el-menu>
    </el-aside>
    <div v-if="isMobileView && mobileMenuOpen" class="aside-mask" @click="closeMobileMenu" />

    <!-- 主内容区 -->
    <el-container class="layout-body">
      <!-- 顶部导航 -->
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="toggleCollapse">
            <Fold v-if="isMobileView ? mobileMenuOpen : !isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.meta?.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
          <span v-if="isMobileView" class="mobile-page-title">{{ currentPageTitle }}</span>
        </div>
        <div class="header-right">
          <div class="version-summary">
            <span :title="`前端 ${frontendVersionLabel}`">前端 {{ frontendVersionLabel }}</span>
            <span :title="`后端 ${backendVersionLabel}`">后端 {{ backendVersionLabel }}</span>
          </div>
          <div class="tenant-context">
            <span class="tenant-label">当前租户</span>
            <el-select
              v-if="userStore.globalAdmin"
              v-model="selectedTenantId"
              placeholder="请选择业务租户"
              class="tenant-select"
              :disabled="userStore.tenantSwitching || userStore.tenantContextBusy"
              @change="handleTenantChange"
            >
              <el-option
                v-for="tenant in userStore.availableTenants"
                :key="tenant.id"
                :label="tenant.tenantName"
                :value="tenant.id"
              />
            </el-select>
            <el-tag v-else type="info">{{ userStore.activeTenantName || '未选择' }}</el-tag>
          </div>
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" :icon="UserFilled" />
              <span class="username">{{ userStore.nickname || userStore.username }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="canManageTenantAdmins" command="tenants">租户管理</el-dropdown-item>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item v-if="canViewSettings" command="settings">系统设置</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </el-main>
      </el-container>
    </el-container>
  </el-watermark>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getSystemVersion } from '@/api/version'
import { formatVersionLabel, frontendVersionLabel } from '@/utils/version'
import { containsMenuPath } from '@/utils/menu'
import { isMobileView } from '@/utils/device'
import SidebarMenu from '@/components/SidebarMenu.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Fold, Expand, Document, List, Plus, Setting, User, Lock,
  Menu, Warning, Monitor, UserFilled, Search
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const selectedTenantId = ref(userStore.activeTenantId)
const canManageTenantAdmins = computed(() => userStore.globalAdmin
  || userStore.roles.includes('SYSTEM_ADMIN'))
const canViewSettings = computed(() => userStore.permissions.includes('settings:view'))
const canViewPlatformSsl = computed(() => userStore.globalAdmin
  && userStore.permissions.includes('platform:ssl:manage'))
const backendVersionInfo = ref({ version: 'unknown', commit: 'unknown' })
const backendVersionLabel = computed(() => formatVersionLabel(
  backendVersionInfo.value.version,
  backendVersionInfo.value.commit,
))

async function loadBackendVersion() {
  try {
    const response = await getSystemVersion()
    backendVersionInfo.value = {
      version: response.data?.version,
      commit: response.data?.commit,
    }
  } catch (error) {
    console.warn('加载后端版本信息失败', error)
  }
}

onMounted(() => {
  void loadBackendVersion()
})

watch(() => userStore.activeTenantId, (value) => {
  selectedTenantId.value = value
}, { immediate: true })

const watermarkContent = computed(() => [
  `用户ID：${String(userStore.userId || '')}`,
  `用户昵称：${userStore.nickname || userStore.username || ''}`,
])

const isCollapse = ref(false)
const mobileMenuOpen = ref(false)
const menuCollapsed = computed(() => isMobileView.value ? false : isCollapse.value)
const asideWidth = computed(() => {
  if (isMobileView.value) return '260px'
  return isCollapse.value ? '64px' : '220px'
})

// 当前激活的菜单
const activeMenu = computed(() => {
  return route.path
})

// 面包屑
const breadcrumbs = computed(() => {
  return route.matched.filter((item) => item.meta?.title)
})
const currentPageTitle = computed(() => route.meta?.title || '工单系统')

// 图标映射
const iconComponentMap = {
  'file-text': Document,
  'list': List,
  'plus': Plus,
  'setting': Setting,
  'user': User,
  'lock': Lock,
  'menu': Menu,
  'document': Document,
  'warning': Warning,
  'monitor': Monitor,
  'team': UserFilled,
  'file-search': Search
}

// 菜单数据完全以后端授权结果为准；空菜单保持为空，不能回退到特权菜单。
const menuRoutes = computed(() => {
  if (userStore.globalAdmin && !userStore.activeTenantId) {
    return withPlatformSslMenu([{
      id: 'system-tenant',
      menuName: '租户管理',
      menuType: 'MENU',
      path: '/system/tenant',
      icon: 'setting',
      children: [],
    }])
  }
  const menus = userStore.menuTree || []
  return withPlatformSslMenu(withTenantAdminMenu(menus))
})

function withPlatformSslMenu(menus) {
  if (!canViewPlatformSsl.value || containsMenuPath(menus, '/system/platform-ssl')) return menus
  return [
    ...menus,
    {
      id: 'platform-ssl',
      menuName: '平台 SSL',
      menuType: 'MENU',
      path: '/system/platform-ssl',
      icon: 'lock',
      children: [],
    },
  ]
}

function withTenantAdminMenu(menus) {
  if (!canManageTenantAdmins.value) return menus
  const alreadyPresent = containsMenuPath(menus, '/system/tenant')
  if (alreadyPresent) return menus
  return [
    {
      id: 'system-tenant',
      menuName: '租户管理',
      menuType: 'MENU',
      path: '/system/tenant',
      icon: 'setting',
      children: [],
    },
    ...menus,
  ]
}

// 获取图标组件
function getIconComponent(iconName) {
  return iconComponentMap[iconName] || Menu
}

// 切换折叠
function toggleCollapse() {
  if (isMobileView.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
    return
  }
  isCollapse.value = !isCollapse.value
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

watch(() => route.fullPath, closeMobileMenu)

watch(isMobileView, (mobile) => {
  if (!mobile) mobileMenuOpen.value = false
})

// 处理下拉命令
async function handleCommand(command) {
  if (command === 'tenants') {
    router.push('/system/tenant')
  } else if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'settings') {
    router.push('/settings')
  } else if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await userStore.logout()
      router.push('/login')
    } catch {
      // 取消操作
    }
  }
}

async function handleTenantChange(tenantId) {
  if (userStore.tenantSwitching || userStore.tenantContextBusy) {
    selectedTenantId.value = userStore.activeTenantId
    return
  }
  if (!tenantId || tenantId === userStore.activeTenantId) return
  try {
    const tenant = userStore.availableTenants.find((item) => item.id === String(tenantId))
    await userStore.switchTenant(tenant || tenantId, {
      onUnrecoverable: () => router.replace('/login'),
    })
    ElMessage.success(`已切换至 ${userStore.activeTenantName}`)
    await router.replace({
      path: '/workorder/list',
      query: { tenant: userStore.activeTenantCode },
    })
  } catch (error) {
    selectedTenantId.value = userStore.activeTenantId
    console.error('切换租户失败', error)
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.layout-aside {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
  z-index: 1001;
}

.logo-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background-color: #263445;
}

.logo-img {
  width: 32px;
  height: 32px;
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-left: 12px;
  white-space: nowrap;
}

.layout-menu {
  border-right: none;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.layout-body {
  min-width: 0;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.collapse-btn:hover {
  color: #409eff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.version-summary {
  display: flex;
  flex-direction: column;
  color: #909399;
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

.tenant-context {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tenant-label {
  color: #606266;
  font-size: 13px;
}

.tenant-select {
  width: 190px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: 14px;
  color: #333;
}

.layout-main {
  background-color: #f0f2f5;
  padding: 20px;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.aside-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
}

.mobile-layout .layout-aside {
  position: fixed;
  inset: 0 auto 0 0;
  transform: translateX(-100%);
  box-shadow: 6px 0 18px rgba(0, 0, 0, 0.18);
}

.mobile-layout .layout-aside.is-mobile-open {
  transform: translateX(0);
}

.mobile-layout .layout-header {
  height: auto;
  min-height: 56px;
  padding: 8px 12px;
  gap: 10px;
}

.mobile-layout .header-left {
  min-width: 0;
  gap: 10px;
}

.mobile-page-title {
  max-width: 96px;
  overflow: hidden;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-layout .header-left :deep(.el-breadcrumb) {
  display: none;
}

.mobile-layout .header-right {
  min-width: 0;
  flex: 1;
  justify-content: flex-end;
  gap: 8px;
}

.mobile-layout .version-summary,
.mobile-layout .tenant-label,
.mobile-layout .username {
  display: none;
}

.mobile-layout .tenant-select {
  width: min(42vw, 160px);
}

.mobile-layout .layout-main {
  padding: 10px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
