<template>
  <QqConnectConfiguration v-if="userStore.globalAdmin" />
</template>

<script setup>
import QqConnectConfiguration from '@/components/QqConnectConfiguration.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
</script>
