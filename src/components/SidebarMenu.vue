<template>
  <template
    v-for="(menu, index) in menus"
    :key="`${parentKey}-${String(menu.id ?? 'menu')}-${index}`"
  >
    <el-menu-item v-if="menu.menuType === 'MENU'" :index="menu.path">
      <el-icon>
        <component :is="getIconComponent(menu.icon)" />
      </el-icon>
      <template #title>{{ menu.menuName }}</template>
    </el-menu-item>
    <el-sub-menu v-else :index="`dir-${parentKey}-${String(menu.id ?? index)}`">
      <template #title>
        <el-icon>
          <component :is="getIconComponent(menu.icon)" />
        </el-icon>
        <span>{{ menu.menuName }}</span>
      </template>
      <SidebarMenu
        :menus="menu.children"
        :get-icon-component="getIconComponent"
        :parent-key="`${parentKey}-${String(menu.id ?? index)}`"
      />
    </el-sub-menu>
  </template>
</template>

<script setup>
defineOptions({ name: 'SidebarMenu' })

defineProps({
  menus: {
    type: Array,
    default: () => [],
  },
  getIconComponent: {
    type: Function,
    required: true,
  },
  parentKey: {
    type: String,
    default: 'root',
  },
})
</script>
