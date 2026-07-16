import { useUserStore } from '@/stores/user'
import { hasPermission } from '@/utils/permission'

function removeElement(el) {
  el.parentNode?.removeChild(el)
}

function checkPermission(el, binding) {
  const { value } = binding
  const userStore = useUserStore()

  if (value && value instanceof Array && value.length > 0) {
    if (!hasPermission(value, userStore.permissions)) removeElement(el)
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

    if (!hasRolePermission) removeElement(el)
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
