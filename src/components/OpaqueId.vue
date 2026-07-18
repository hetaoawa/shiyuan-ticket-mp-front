<template>
  <span class="opaque-id" :class="{ 'is-empty': !hasValue }">
    <el-tooltip v-if="hasValue" :content="copyText" placement="top" :show-after="300">
      <router-link v-if="to" :to="to" class="opaque-id__link">
        {{ displayText }}
      </router-link>
      <span v-else class="opaque-id__text">{{ displayText }}</span>
    </el-tooltip>
    <span v-else class="opaque-id__text">{{ displayText }}</span>

    <el-tooltip v-if="hasValue && copyable" :content="`复制${copyName}`" placement="top" :show-after="300">
      <button
        type="button"
        class="opaque-id__copy"
        :aria-label="`复制${copyName} ${copyText}`"
        @click.stop="copy"
      >
        <el-icon><CopyDocument /></el-icon>
      </button>
    </el-tooltip>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

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
  to: {
    type: [String, Object],
    default: '',
  },
  copyable: {
    type: Boolean,
    default: true,
  },
  copyName: {
    type: String,
    default: '内容',
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
    ElMessage.success(`${props.copyName}已复制`)
  } catch (error) {
    console.error(`复制${props.copyName}失败:`, error)
    ElMessage.warning('复制失败，请手动复制')
  }
}
</script>

<style scoped>
.opaque-id {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-width: 0;
  gap: 4px;
  vertical-align: bottom;
}

.opaque-id__text,
.opaque-id__link {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  line-height: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opaque-id__link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.opaque-id__link:hover {
  text-decoration: underline;
}

.opaque-id__link:focus-visible,
.opaque-id__copy:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}

.opaque-id__copy {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: copy;
}

.opaque-id__copy:hover {
  color: var(--el-color-primary);
}

.opaque-id.is-empty {
  color: inherit;
}
</style>
