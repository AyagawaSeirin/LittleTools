<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  BgColorsOutlined,
  BulbOutlined,
  CloudSyncOutlined,
  DisconnectOutlined,
  MenuOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import { findTool } from './config/tools'
import ToolNavigation from './components/ToolNavigation.vue'
import { useToolOrder } from './composables/useToolOrder'
import { useTheme } from './composables/useTheme'
import { useServiceWorker } from './composables/useServiceWorker'
import { contrastingText } from './utils/color'

const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
const colorOpen = ref(false)
const { isDark, primaryColor, themeLabel, resetColor } = useTheme()
const { isAvailable: cacheAvailable, isOffline, isUpdating, updateAvailable, cacheButtonText, cacheButtonTitle, refreshCache } = useServiceWorker()
const colorPresets = ['#276b63', '#2463a7', '#7a4f9a', '#a44d58', '#a05d24', '#486b3d']
const { storageFailed, orderAnnouncement } = useToolOrder()

const selectedKeys = computed(() => [route.path])
const currentTool = computed(() => findTool(route.path))
const themeConfig = computed(() => {
  const algorithm = isDark.value ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
  const palette = algorithm({ ...antdTheme.defaultSeed, colorPrimary: primaryColor.value })
  return {
    algorithm,
    token: {
      colorPrimary: primaryColor.value,
      colorTextLightSolid: contrastingText(palette.colorPrimary),
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      colorBgLayout: isDark.value ? '#111513' : '#f3f5f2',
    },
  }
})

function navigate({ key }: { key: string }) {
  router.push(key)
  drawerOpen.value = false
}
</script>

<template>
  <a-config-provider :theme="themeConfig" :locale="zhCN">
    <a-app>
      <a-layout class="app-shell">
        <a-layout-sider class="app-sider" :width="248">
          <router-link to="/" class="brand" aria-label="LittleTools 首页">
            <span class="brand-mark"><ToolOutlined /></span>
            <span>
              <strong>LittleTools</strong>
              <small>轻量浏览器工具箱</small>
            </span>
          </router-link>
          <ToolNavigation class="side-menu" :selected-keys="selectedKeys" @navigate="navigate" />
          <div class="sider-foot">
            <span>本地优先处理</span>
          </div>
        </a-layout-sider>

        <a-drawer v-model:open="drawerOpen" placement="left" :width="286" title="工具导航" class="mobile-drawer">
          <router-link to="/" class="brand drawer-brand" @click="drawerOpen = false">
            <span class="brand-mark"><ToolOutlined /></span>
            <span><strong>LittleTools</strong><small>轻量浏览器工具箱</small></span>
          </router-link>
          <ToolNavigation :selected-keys="selectedKeys" @navigate="navigate" />
        </a-drawer>

        <a-layout class="main-layout">
          <a-layout-header class="topbar">
            <div class="topbar-left">
              <a-button class="mobile-menu-button" type="text" aria-label="打开菜单" @click="drawerOpen = true">
                <template #icon><MenuOutlined /></template>
              </a-button>
              <div class="page-context">
                <span>工具箱</span>
                <b v-if="currentTool">/</b>
                <strong v-if="currentTool">{{ currentTool.shortName }}</strong>
              </div>
            </div>
            <div class="topbar-actions">
              <a-tag v-if="isOffline" class="offline-tag" role="status" aria-label="离线模式"><DisconnectOutlined /> <span>离线模式</span></a-tag>
              <a-tooltip v-if="cacheAvailable" :title="cacheButtonTitle">
                <a-button class="cache-button" type="text" :loading="isUpdating" :disabled="isOffline" aria-label="更新本地缓存" @click="refreshCache">
                  <template #icon><CloudSyncOutlined /></template>
                  <span class="cache-button-label">{{ cacheButtonText }}</span>
                  <i v-if="updateAvailable" class="update-dot" />
                </a-button>
              </a-tooltip>
              <a-popover v-model:open="colorOpen" trigger="click" placement="bottomRight">
                <template #content>
                  <div class="color-picker-panel">
                    <div class="color-panel-head"><strong>主题色</strong><a-button type="link" size="small" @click="resetColor">恢复默认</a-button></div>
                    <div class="color-presets">
                      <button
                        v-for="color in colorPresets"
                        :key="color"
                        class="color-swatch"
                        :class="{ active: primaryColor === color }"
                        :style="{ background: color }"
                        :aria-label="`选择主题色 ${color}`"
                        :aria-pressed="primaryColor === color"
                        @click="primaryColor = color"
                      />
                      <label class="custom-color" title="自定义主题色">
                        <BgColorsOutlined />
                        <input v-model="primaryColor" type="color" aria-label="选择自定义颜色" />
                      </label>
                    </div>
                  </div>
                </template>
                <a-button type="text" aria-label="自定义主题色"><BgColorsOutlined /></a-button>
              </a-popover>
              <a-tooltip :title="themeLabel">
                <a-button type="text" :aria-label="themeLabel" @click="isDark = !isDark">
                  <BulbOutlined />
                </a-button>
              </a-tooltip>
            </div>
          </a-layout-header>
          <a-layout-content class="app-content">
            <main class="content-inner">
              <p v-if="storageFailed" class="order-storage-warning" role="alert">浏览器未能保存工具顺序，本次调整仅在当前页面生效。请检查浏览器存储设置或可用空间后重试。</p>
              <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ orderAnnouncement }}</span>
              <router-view />
              <footer class="app-footer">LittleTools · 数据优先在你的浏览器中处理</footer>
            </main>
          </a-layout-content>
        </a-layout>
      </a-layout>
    </a-app>
  </a-config-provider>
</template>
