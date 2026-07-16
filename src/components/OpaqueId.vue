<template>
  <el-tooltip
    :content="copyText"
    :disabled="!hasValue"
    placement="top"
    :show-after="300"
  >
    <span
      class="opaque-id"
      :class="{ 'is-empty': !hasValue }"
      :tabindex="hasValue ? 0 : undefined"
      :role="hasValue ? 'button' : undefined"
      :aria-label="hasValue ? `复制 ${copyText}` : undefined"
      @click="copy"
      @keydown.enter.prevent="copy"
      @keydown.space.prevent="copy"
    >{{ displayText }}</span>
  </el-tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  value: {
    type: [String, Number, BigInt],
    default: null,
  },
  label: {
    type: [String, Number, BigInt],
    default: null,
  },
  emptyText: {
    type: String,
    default: '-',
  },
})

const hasValue = computed(() => props.value !== null
  && props.value !== undefined
  && String(props.value).length > 0)
const copyText = computed(() => hasValue.value ? String(props.value) : '')
const displayText = computed(() => {
  if (!hasValue.value) return props.emptyText
  if (props.label === null || props.label === undefined || String(props.label).length === 0) {
    return copyText.value
  }
  return String(props.label)
})

async function copy() {
  if (!hasValue.value) return

  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(copyText.value)
    } else {
      const textarea = document.createElement('textarea')
      try {
        textarea.value = copyText.value
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        if (!document.execCommand('copy')) throw new Error('copy command was rejected')
      } finally {
        textarea.remove()
      }
    }
    ElMessage.success('ID 已复制')
  } catch (error) {
    console.error('复制 ID 失败:', error)
    ElMessage.warning('复制失败，请手动复制')
  }
}
</script>

<style scoped>
.opaque-id {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--el-color-primary);
  line-height: inherit;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
  cursor: copy;
  outline: none;
}

.opaque-id:focus-visible {
  border-radius: 2px;
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}

.opaque-id.is-empty {
  color: inherit;
  cursor: default;
}
</style>
