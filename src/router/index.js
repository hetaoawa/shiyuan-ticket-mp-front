import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { canAccessRoute } from '@/utils/permission'
import { buildLoginLocation } from '@/utils/tenant-login'

const staticRoutes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layout/index.vue'),
    redirect: '/workorder/list',
    children: [
      {
        path: 'workorder/list',
        name: 'WorkorderList',
        component: () => import('@/views/workorder/list.vue'),
        meta: { title: '工单列表', permission: 'workorder:view' }
      },
      {
        path: 'workorder/create',
        name: 'WorkorderCreate',
        component: () => import('@/views/workorder/create.vue'),
        meta: { title: '创建工单', permission: 'workorder:create' }
      },
      {
        path: 'workorder/detail/:id',
        name: 'WorkorderDetail',
        component: () => import('@/views/workorder/detail.vue'),
        meta: { title: '工单详情', permission: 'workorder:view' }
      },
      {
        path: 'system/deadletter',
        name: 'Deadletter',
        component: () => import('@/views/admin/deadletters.vue'),
        meta: { title: '死信管理', permission: 'deadletter:view' }
      },
      {
        path: 'system/audit',
        name: 'AuditLogs',
        component: () => import('@/views/audit/logs.vue'),
        meta: { title: '审计日志', permission: 'audit:view' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人中心' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '系统设置', permission: 'settings:view' }
      },
      {
        path: 'system/tenant',
        name: 'AdminTenants',
        component: () => import('@/views/admin/tenants.vue'),
        meta: { title: '租户管理' }
      },
      {
        path: 'system/user',
        name: 'AdminUsers',
        component: () => import('@/views/admin/users.vue'),
        meta: { title: '用户管理', permission: 'user:view' }
      },
      {
        path: 'system/role',
        name: 'AdminRoles',
        component: () => import('@/views/admin/roles.vue'),
        meta: { title: '角色管理', permission: 'role:view' }
      },
      {
        path: 'system/menu',
        name: 'AdminMenus',
        component: () => import('@/views/admin/menus.vue'),
        meta: { title: '菜单管理', permission: 'menu:view' }
      },
      {
        path: ':pathMatch(.*)*',
        name: 'LayoutNotFound',
        component: () => import('@/views/error/404.vue'),
        meta: { title: '页面不存在' }
      }
    ]
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes
})

const whiteList = ['/login']

function canAccessTargetRoute(to, userStore) {
  return to.matched.every(record => canAccessRoute(record.meta, {
    permissions: userStore.permissions,
    globalAdmin: userStore.globalAdmin,
  }))
}

router.beforeEach(async (to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 中台工单流转系统` : '中台工单流转系统'

  const userStore = useUserStore()

  if (whiteList.includes(to.path)) {
    next()
    return
  }

  if (!userStore.token) {
    next(buildLoginLocation(to))
    return
  }

  if (!userStore.routerLoaded) {
    try {
      await userStore.getUserInfo()
      if (userStore.globalAdmin) {
        await userStore.loadAvailableTenants()
      }
      if (userStore.globalAdmin && !userStore.activeTenantId) {
        userStore.setRouterLoaded(true)
        next(to.path === '/system/tenant'
          ? { ...to, replace: true }
          : { path: '/system/tenant', replace: true })
        return
      }
      await userStore.getMenuTree()
      userStore.setRouterLoaded(true)
      if (to.path === '/system/tenant'
        && !userStore.globalAdmin
        && !userStore.roles.includes('SYSTEM_ADMIN')) {
        next({ path: '/', replace: true })
        return
      }
      if (!canAccessTargetRoute(to, userStore)) {
        next({ path: '/404', replace: true })
        return
      }
      next({ ...to, replace: true })
    } catch (error) {
      userStore.resetState()
      next(buildLoginLocation(to))
    }
    return
  }

  if (userStore.globalAdmin && !userStore.activeTenantId && to.path !== '/system/tenant') {
    next('/system/tenant')
    return
  }

  if (!userStore.globalAdmin
    && !userStore.roles.includes('SYSTEM_ADMIN')
    && to.path === '/system/tenant') {
    next('/')
    return
  }

  if (!canAccessTargetRoute(to, userStore)) {
    next('/404')
    return
  }

  next()
})

export default router
