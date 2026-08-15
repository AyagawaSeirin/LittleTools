<script setup lang="ts">
import { ArrowRightOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { tools } from '../config/tools'
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <div>
        <span class="eyebrow"><SafetyCertificateOutlined /> 本地优先 · 即开即用</span>
        <h1>小工具，也应该<br />清楚、快速、好用。</h1>
        <p>一组为日常开发和办公准备的浏览器工具。无需注册，计算数据默认不离开你的设备。</p>
      </div>
      <div class="hero-index" aria-hidden="true">
        <span>LT</span>
        <small>08 tools</small>
      </div>
    </section>

    <div class="section-title">
      <div><h2>全部工具</h2><p>选择一个工具开始</p></div>
      <span>{{ tools.length }} 项</span>
    </div>

    <section class="tool-grid">
      <router-link v-for="(tool, index) in tools" :key="tool.key" :to="tool.path" class="tool-tile">
        <div class="tile-top">
          <span class="tile-icon" :style="{ '--tile-color': tool.color }"><component :is="tool.icon" /></span>
          <span class="tile-index">{{ String(index + 1).padStart(2, '0') }}</span>
        </div>
        <h3>{{ tool.name }}</h3>
        <p>{{ tool.description }}</p>
        <span class="tile-link">打开工具 <ArrowRightOutlined /></span>
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.home-hero { display: grid; grid-template-columns: 1fr 180px; align-items: end; min-height: 250px; margin-bottom: 44px; padding: 38px 40px; overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: var(--panel-bg); box-shadow: var(--shadow); }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 20px; color: var(--primary-color); font-size: 12px; font-weight: 650; letter-spacing: .04em; }
h1 { margin: 0; color: var(--text-main); font-size: clamp(34px, 5vw, 54px); letter-spacing: -.055em; line-height: 1.08; }
.home-hero p { max-width: 610px; margin: 20px 0 0; color: var(--text-muted); font-size: 15px; line-height: 1.8; }
.hero-index { justify-self: end; display: flex; width: 132px; height: 132px; flex-direction: column; align-items: center; justify-content: center; border: 1px solid color-mix(in srgb, var(--primary-color) 30%, var(--line)); border-radius: 50%; color: var(--primary-color); }
.hero-index span { font-size: 40px; font-weight: 750; letter-spacing: -.08em; }
.hero-index small { margin-top: 2px; color: var(--text-muted); font-family: monospace; }
.section-title { display: flex; align-items: end; justify-content: space-between; margin-bottom: 16px; }
.section-title h2 { margin: 0; color: var(--text-main); font-size: 19px; }
.section-title p { margin: 5px 0 0; color: var(--text-muted); font-size: 12px; }
.section-title > span { color: var(--text-muted); font-family: monospace; font-size: 12px; }
.tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.tool-tile { position: relative; min-height: 210px; padding: 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-bg); color: var(--text-main); text-decoration: none; transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.tool-tile:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--primary-color) 45%, var(--line)); box-shadow: var(--shadow); color: var(--text-main); }
.tile-top { display: flex; align-items: flex-start; justify-content: space-between; }
.tile-icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--tile-color) 11%, var(--panel-bg)); color: var(--tile-color); font-size: 19px; }
.tile-index { color: var(--text-muted); font-family: monospace; font-size: 11px; }
.tool-tile h3 { margin: 23px 0 7px; font-size: 17px; }
.tool-tile p { max-width: 360px; margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.tile-link { position: absolute; bottom: 22px; left: 24px; display: inline-flex; align-items: center; gap: 7px; color: var(--primary-color); font-size: 12px; font-weight: 600; }
@media (max-width: 640px) { .home-hero { grid-template-columns: 1fr; min-height: 0; margin-bottom: 30px; padding: 28px 24px; } .hero-index { display: none; } .tool-grid { grid-template-columns: 1fr; } .tool-tile { min-height: 195px; } }
</style>
