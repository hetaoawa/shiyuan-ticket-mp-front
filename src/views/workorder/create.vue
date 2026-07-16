<template>
  <div class="workorder-create">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>创建工单</span>
          <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
        </div>
      </template>
      <WorkOrderCreateEditor @completed="handleCompleted" />
    </el-card>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import WorkOrderCreateEditor from '@/components/WorkOrderCreateEditor.vue'

const router = useRouter()

async function handleCompleted() {
  await router.push('/workorder/list')
}
</script>

<style scoped>
.workorder-create { max-width: 960px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
</style>
