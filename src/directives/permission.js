import { useUserStore } from '@/stores/user'

// 权限指令 v-hasPermi
export const hasPermi = {
  mounted(el, binding) {
    const { value } = binding
    const userStore = useUserStore()

    if (value && value instanceof Array && value.length > 0) {
      const permissions = value
      const hasPermission = permissions.some((permission) => {
        return userStore.permissions.includes(permission)
      })

      if (!hasPermission) {
        el.parentNode?.removeChild(el)
      }
    }
  },
}

// 角色指令 v-hasRole
export const hasRole = {
  mounted(el, binding) {
    const { value } = binding
    const userStore = useUserStore()

    if (value && value instanceof Array && value.length > 0) {
      const roles = value
      const hasRolePermission = roles.some((role) => {
        return userStore.roles.includes(role)
      })

      if (!hasRolePermission) {
        el.parentNode?.removeChild(el)
      }
    }
  },
}
