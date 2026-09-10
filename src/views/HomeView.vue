<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRightOutlined } from '@ant-design/icons-vue'
import ToolDragHandle from '../components/ToolDragHandle.vue'
import { useToolOrder } from '../composables/useToolOrder'
import { useSortableTools } from '../composables/useSortableTools'

const grid = ref<HTMLElement | null>(null)
const { orderedTools, hasCustomOrder, resetOrder } = useToolOrder()
useSortableTools(() => grid.value)
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <h1>浏览器工具箱</h1>
      <p>生成密码、计算日期、处理文本与网络参数。无需注册，主要计算在浏览器本地完成。</p>
    </section>

    <div class="section-title">
      <div class="section-heading"><h2>全部工具</h2><span>{{ orderedTools.length }} 项</span></div>
      <a-button size="small" :disabled="!hasCustomOrder" @click="resetOrder">恢复默认顺序</a-button>
    </div>
    <p class="sort-hint">拖动卡片或导航右侧的手柄调整顺序，自动保存在当前浏览器。</p>

    <section ref="grid" class="tool-grid" aria-label="全部工具">
      <div v-for="tool in orderedTools" :key="tool.key" :data-tool-key="tool.key" class="tool-tile">
        <router-link :to="tool.path" class="tool-tile-link" :draggable="false">
          <span class="tile-icon" aria-hidden="true"><component :is="tool.icon" /></span>
          <div class="tile-content"><h3>{{ tool.name }}</h3><p>{{ tool.description }}</p></div>
          <ArrowRightOutlined class="tile-arrow" aria-hidden="true" />
        </router-link>
        <ToolDragHandle :tool-key="tool.key" :name="tool.name" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-hero { margin-bottom: 36px; }
h1 { margin: 0; color: var(--text-main); font-size: clamp(28px, 3vw, 38px); letter-spacing: -.025em; line-height: 1.3; }
.home-hero p { max-width: 640px; margin: 14px 0 0; color: var(--text-muted); font-size: 15px; line-height: 1.8; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.section-heading { display: flex; align-items: baseline; gap: 10px; }
.section-title h2 { margin: 0; color: var(--text-main); font-size: 20px; }
.section-heading > span { color: var(--text-muted); font-size: 13px; white-space: nowrap; }
.sort-hint { margin: 0 0 16px; color: var(--text-muted); font-size: 12px; }
.tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.tool-tile { display: flex; align-items: center; min-width: 0; padding-right: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-bg); color: var(--text-main); transition: border-color .15s ease, background .15s ease; }
.tool-tile-link { display: grid; flex: 1; min-width: 0; grid-template-columns: 24px minmax(0, 1fr) 16px; align-items: start; gap: 14px; align-self: stretch; padding: 22px 10px 22px 22px; color: inherit; text-decoration: none; border-radius: 8px; }
.tool-tile-link:hover { color: inherit; }
.tool-tile:hover { border-color: var(--primary-color); background: var(--panel-subtle); color: var(--text-main); }
.tile-icon { padding-top: 2px; color: var(--text-muted); font-size: 21px; }
.tile-content { min-width: 0; }
.tool-tile h3 { margin: 0 0 7px; font-size: 17px; line-height: 1.5; }
.tool-tile p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.7; }
.tile-arrow { align-self: center; color: var(--text-muted); font-size: 14px; }
@media (max-width: 640px) { .home-hero { margin-bottom: 28px; } .tool-grid { grid-template-columns: 1fr; } .tool-tile { padding-right: 6px; } .tool-tile-link { gap: 10px; padding: 18px 6px 18px 16px; } }
</style>
