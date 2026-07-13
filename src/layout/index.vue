<template>
  <el-watermark :content="watermarkContent">
    <el-container class="layout-container">
      <!-- 侧边栏 -->
      <el-aside :width="isCollapse ? '64px' : '220px'" class="layout-aside">
        <div class="logo-container">
          <img src="@/assets/project-logo.png" alt="Logo" class="logo-img" />
          <span v-show="!isCollapse" class="logo-text">中台工单流转系统</span>
        </div>
        <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :unique-opened="true"
        router
        class="layout-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <template v-for="menu in menuRoutes" :key="menu.id">
          <!-- 单级菜单（无子菜单） -->
          <el-menu-item
            v-if="!menu.children || menu.children.length === 0"
            :index="menu.path"
          >
            <el-icon>
              <component :is="getIconComponent(menu.icon)" />
            </el-icon>
            <template #title>{{ menu.menuName }}</template>
          </el-menu-item>

          <!-- 多级菜单 -->
          <el-sub-menu v-else :index="String(menu.id)">
            <template #title>
              <el-icon>
                <component :is="getIconComponent(menu.icon)" />
              </el-icon>
              <span>{{ menu.menuName }}</span>
            </template>
            <el-menu-item
              v-for="child in menu.children"
              :key="child.id"
              :index="child.path"
            >
              <el-icon>
                <component :is="getIconComponent(child.icon)" />
              </el-icon>
              <template #title>{{ child.menuName }}</template>
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <!-- 顶部导航 -->
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="toggleCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.meta?.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
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
                <el-dropdown-item command="settings">系统设置</el-dropdown-item>
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

// 当前激活的菜单
const activeMenu = computed(() => {
  return route.path
})

// 面包屑
const breadcrumbs = computed(() => {
  return route.matched.filter((item) => item.meta?.title)
})

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

// 静态回退菜单（API 无数据时使用）
const fallbackMenus = [
  {
    id: 'workorder',
    menuName: '工单管理',
    icon: 'file-text',
    children: [
      { id: 'workorder-list', menuName: '工单列表', path: '/workorder/list', icon: 'list' },
      { id: 'workorder-create', menuName: '创建工单', path: '/workorder/create', icon: 'plus' }
    ]
  },
  {
    id: 'system',
    menuName: '系统管理',
    icon: 'setting',
    children: [
      { id: 'system-user', menuName: '用户管理', path: '/system/user', icon: 'user' },
      { id: 'system-role', menuName: '角色管理', path: '/system/role', icon: 'team' },
      { id: 'system-menu', menuName: '菜单管理', path: '/system/menu', icon: 'menu' },
      { id: 'system-deadletter', menuName: '死信管理', path: '/system/deadletter', icon: 'warning' },
      { id: 'system-audit', menuName: '审计日志', path: '/system/audit', icon: 'monitor' }
    ]
  }
]

// 菜单数据（基于 API，修复重复路径；API 无数据时回退静态菜单）
const menuRoutes = computed(() => {
  if (userStore.globalAdmin && !userStore.activeTenantId) {
    return [{ id: 'system-tenant', menuName: '租户管理', path: '/system/tenant', icon: 'setting' }]
  }
  const menus = userStore.menuTree
  if (!menus || menus.length === 0) return withTenantAdminMenu(fallbackMenus)
  // 过滤 BUTTON 节点（按钮权限不应显示在侧边栏）
  const visibleMenus = menus
    .filter(parent => parent.menuType !== 'BUTTON')
    .map(parent => {
      if (!parent.children || parent.children.length === 0) return parent
      return {
        ...parent,
        children: parent.children.filter(child => child.menuType !== 'BUTTON')
      }
    })
    // 过滤掉没有子菜单的 DIR 节点（避免显示空目录）
    .filter(parent => {
      if (parent.menuType === 'DIR' && parent.children && parent.children.length === 0) return false
      return true
    })
  // 修复后端返回重复路径的 bug（如角色管理路径与用户管理相同）
  const usedPaths = new Set()
  const normalizedMenus = visibleMenus.map(parent => {
    if (!parent.children || parent.children.length === 0) return parent
    return {
      ...parent,
      children: parent.children.map(child => {
        let path = child.path
        if (usedPaths.has(path)) {
          // 路径重复，使用 menuCode 生成唯一路径
          path = '/' + child.menuCode.replace(/:/g, '/')
        }
        usedPaths.add(path)
        return { ...child, path }
      })
    }
  })
  return withTenantAdminMenu(normalizedMenus)
})

function withTenantAdminMenu(menus) {
  if (!canManageTenantAdmins.value) return menus
  const alreadyPresent = menus.some(menu => menu.path === '/system/tenant'
    || menu.children?.some(child => child.path === '/system/tenant'))
  if (alreadyPresent) return menus
  return [
    { id: 'system-tenant', menuName: '租户管理', path: '/system/tenant', icon: 'setting' },
    ...menus,
  ]
}

// 获取图标组件
function getIconComponent(iconName) {
  return iconComponentMap[iconName] || Menu
}

// 切换折叠
function toggleCollapse() {
  isCollapse.value = !isCollapse.value
}

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
  if (!tenantId || tenantId === userStore.activeTenantId) return
  try {
    await userStore.switchTenant(tenantId, {
      onUnrecoverable: () => router.replace('/login'),
    })
    ElMessage.success(`已切换至 ${userStore.activeTenantName}`)
    await router.replace({ path: '/workorder/list', query: { tenant: tenantId } })
  } catch (error) {
    selectedTenantId.value = userStore.activeTenantId
    console.error('切换租户失败', error)
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.layout-aside {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
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
