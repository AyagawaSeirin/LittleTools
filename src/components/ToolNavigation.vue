<script setup lang="ts">
import { ref } from 'vue'
import { AppstoreOutlined } from '@ant-design/icons-vue'
import ToolDragHandle from './ToolDragHandle.vue'
import { useToolOrder } from '../composables/useToolOrder'
import { useSortableTools } from '../composables/useSortableTools'

defineProps<{ selectedKeys: string[] }>()
const emit = defineEmits<{ navigate: [event: { key: string }] }>()
const container = ref<HTMLElement | null>(null)
const { orderedTools } = useToolOrder()
useSortableTools(() => container.value?.querySelector<HTMLElement>('.ant-menu'))
</script>

<template>
  <nav ref="container" class="tool-navigation" aria-label="工具导航">
    <a-menu mode="inline" :selected-keys="selectedKeys" @click="emit('navigate', $event)">
      <a-menu-item key="/">
        <template #icon><AppstoreOutlined aria-hidden="true" /></template>
        工具首页
      </a-menu-item>
      <a-menu-divider />
      <a-menu-item v-for="tool in orderedTools" :key="tool.path" :data-tool-key="tool.key">
        <template #icon><component :is="tool.icon" aria-hidden="true" /></template>
        <span class="tool-nav-label">
          <span>{{ tool.shortName }}</span>
          <ToolDragHandle :tool-key="tool.key" :name="tool.shortName" />
        </span>
      </a-menu-item>
    </a-menu>
  </nav>
</template>
