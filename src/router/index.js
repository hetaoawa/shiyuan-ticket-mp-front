import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const staticRoutes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  // Layout parent route - dynamic child routes will be added under this named route
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layout/index.vue'),
    redirect: '/workorder/list',
    children: []
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' }
  }
]

const layout = () => import('@/layout/index.vue')

const viewModules = {
  '/workorder/list': () => import('@/views/workorder/list.vue'),
  '/workorder/create': () => import('@/views/workorder/create.vue'),
  '/workorder/detail': () => import('@/views/workorder/detail.vue'),
  '/deadletter': () => import('@/views/admin/deadletters.vue'),
  '/audit/logs': () => import('@/views/audit/logs.vue'),
  '/profile': () => import('@/views/profile/index.vue'),
  '/settings': () => import('@/views/settings/index.vue'),
  '/admin/menus': () => import('@/views/admin/menus.vue')
}

function buildRoutesFromMenus(menus) {
  const routes = []
  for (const menu of menus) {
    if (menu.children && menu.children.length > 0) {
      for (const child of menu.children) {
        // normalize path: backend may return paths with or without leading '/'
        const raw = child.path || ''
        const pathKey = raw.startsWith('/') ? raw : `/${raw}`
        const viewFn = viewModules[pathKey] || viewModules[raw]
        if (viewFn) {
          // when adding as child of Layout, use relative path (no leading '/')
          const childPath = pathKey.replace(/^\//, '')
          routes.push({
            path: childPath,
            name: child.menuCode,
            component: viewFn,
            meta: {
              title: child.menuName,
              icon: child.icon
            }
          })
        }
      }
    } else if (menu.path && menu.menuType === 'MENU') {
      const raw = menu.path || ''
      const pathKey = raw.startsWith('/') ? raw : `/${raw}`
      const viewFn = viewModules[pathKey] || viewModules[raw]
      if (viewFn) {
        const childPath = pathKey.replace(/^\//, '')
        routes.push({
          path: childPath,
          name: menu.menuCode,
          component: viewFn,
          meta: {
            title: menu.menuName,
            icon: menu.icon
          }
        })
      }
    }
  }
  return routes
}

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes
})

const whiteList = ['/login']

router.beforeEach(async (to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 云仓工单系统` : '云仓工单系统'

  const userStore = useUserStore()

  if (whiteList.includes(to.path)) {
    next()
    return
  }

  if (!userStore.token) {
    next(`/login?redirect=${to.path}`)
    return
  }

  if (!userStore.routerLoaded) {
    try {
      await userStore.getUserInfo()
      const menus = await userStore.getMenuTree()
      const dynamicRoutes = buildRoutesFromMenus(menus)

      dynamicRoutes.forEach(route => {
        router.addRoute('Layout', route)
      })

      router.addRoute({
        path: '/:pathMatch(.*)*',
        redirect: '/404'
      })

      userStore.setRouterLoaded(true)
      next({ ...to, replace: true })
    } catch (error) {
      userStore.resetState()
      next(`/login?redirect=${to.path}`)
    }
    return
  }

  next()
})

export default router
