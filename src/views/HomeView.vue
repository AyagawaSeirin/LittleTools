<script setup lang="ts">
import { ArrowRightOutlined } from '@ant-design/icons-vue'
import { tools } from '../config/tools'
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <h1>浏览器工具箱</h1>
      <p>生成密码、计算日期、处理文本与网络参数。无需注册，主要计算在浏览器本地完成。</p>
    </section>

    <div class="section-title">
      <h2>全部工具</h2>
      <span>{{ tools.length }} 项</span>
    </div>

    <section class="tool-grid">
      <router-link v-for="tool in tools" :key="tool.key" :to="tool.path" class="tool-tile">
        <span class="tile-icon" aria-hidden="true"><component :is="tool.icon" /></span>
        <div class="tile-content"><h3>{{ tool.name }}</h3><p>{{ tool.description }}</p></div>
        <ArrowRightOutlined class="tile-arrow" aria-hidden="true" />
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.home-hero { margin-bottom: 36px; }
h1 { margin: 0; color: var(--text-main); font-size: clamp(28px, 3vw, 38px); letter-spacing: -.025em; line-height: 1.3; }
.home-hero p { max-width: 640px; margin: 14px 0 0; color: var(--text-muted); font-size: 15px; line-height: 1.8; }
.section-title { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
.section-title h2 { margin: 0; color: var(--text-main); font-size: 20px; }
.section-title > span { color: var(--text-muted); font-size: 13px; }
.tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.tool-tile { display: grid; grid-template-columns: 24px minmax(0, 1fr) 16px; align-items: start; gap: 14px; padding: 22px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-bg); color: var(--text-main); text-decoration: none; transition: border-color .15s ease, background .15s ease; }
.tool-tile:hover { border-color: var(--primary-color); background: var(--panel-subtle); color: var(--text-main); }
.tile-icon { padding-top: 2px; color: var(--text-muted); font-size: 21px; }
.tile-content { min-width: 0; }
.tool-tile h3 { margin: 0 0 7px; font-size: 17px; line-height: 1.5; }
.tool-tile p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.7; }
.tile-arrow { align-self: center; color: var(--text-muted); font-size: 14px; }
@media (max-width: 640px) { .home-hero { margin-bottom: 28px; } .tool-grid { grid-template-columns: 1fr; } .tool-tile { gap: 12px; padding: 18px 16px; } }
</style>
