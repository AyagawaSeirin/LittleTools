<script setup lang="ts">
import { CheckOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { ref } from 'vue'

const props = defineProps<{
  value: string
  emptyText?: string
  label?: string
}>()

const copied = ref(false)

async function copy() {
  if (!props.value) return
  await navigator.clipboard.writeText(props.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1600)
}
</script>

<template>
  <div class="result-panel" :class="{ empty: !value }">
    <div class="result-panel-head">
      <span>{{ label || '生成结果' }}</span>
      <a-button v-if="value" type="text" size="small" @click="copy">
        <template #icon><CheckOutlined v-if="copied" /><CopyOutlined v-else /></template>
        {{ copied ? '已复制' : '复制' }}
      </a-button>
    </div>
    <pre>{{ value || emptyText || '结果会显示在这里' }}</pre>
  </div>
</template>
