import { useUserStore } from '@/stores/user'

function checkPermission(el, binding) {
  const { value } = binding
  const userStore = useUserStore()

  if (value && value instanceof Array && value.length > 0) {
    const permissions = value
    const hasPermission = permissions.some((permission) => {
      return userStore.permissions.includes(permission)
    })

    if (!hasPermission) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }
  }
}

function checkRole(el, binding) {
  const { value } = binding
  const userStore = useUserStore()

  if (value && value instanceof Array && value.length > 0) {
    const roles = value
    const hasRolePermission = roles.some((role) => {
      return userStore.roles.includes(role)
    })

    if (!hasRolePermission) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }
  }
}

// 权限指令 v-hasPermi
export const hasPermi = {
  mounted: checkPermission,
  updated: checkPermission,
}

// 角色指令 v-hasRole
export const hasRole = {
  mounted: checkRole,
  updated: checkRole,
}
