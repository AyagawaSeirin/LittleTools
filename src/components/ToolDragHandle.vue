<script setup lang="ts">
import { nextTick } from 'vue'
import { HolderOutlined } from '@ant-design/icons-vue'
import { useToolOrder } from '../composables/useToolOrder'

const props = defineProps<{ toolKey: string; name: string }>()
const { orderedTools, moveTool } = useToolOrder()

async function reorderWithKeyboard(event: KeyboardEvent) {
  const index = orderedTools.value.findIndex((tool) => tool.key === props.toolKey)
  const targets: Record<string, number> = {
    ArrowUp: index - 1,
    ArrowLeft: index - 1,
    ArrowDown: index + 1,
    ArrowRight: index + 1,
    Home: 0,
    End: orderedTools.value.length - 1,
  }
  const target = targets[event.key]
  if (target === undefined) return
  event.preventDefault()
  const handle = event.currentTarget as HTMLButtonElement
  moveTool(props.toolKey, target)
  await nextTick()
  handle.focus({ preventScroll: true })
}
</script>

<template>
  <button
    class="tool-drag-handle"
    type="button"
    :aria-label="`调整${name}的顺序`"
    title="拖拽调整顺序；也可聚焦后使用方向键，Home / End 移至首尾"
    @click.stop.prevent
    @keydown.stop="reorderWithKeyboard"
    @keyup.stop
  ><HolderOutlined aria-hidden="true" /></button>
</template>
