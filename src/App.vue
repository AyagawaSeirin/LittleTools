<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  AppstoreOutlined,
  BgColorsOutlined,
  BulbOutlined,
  CloudSyncOutlined,
  DisconnectOutlined,
  MenuOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import { tools, findTool } from './config/tools'
import { useTheme } from './composables/useTheme'
import { useServiceWorker } from './composables/useServiceWorker'

const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
const colorOpen = ref(false)
const { isDark, primaryColor, themeLabel, resetColor } = useTheme()
const { isAvailable: cacheAvailable, isOffline, isUpdating, updateAvailable, cacheButtonText, cacheButtonTitle, refreshCache } = useServiceWorker()
const colorPresets = ['#276b63', '#2463a7', '#7a4f9a', '#a44d58', '#a05d24', '#486b3d']

const selectedKeys = computed(() => [route.path])
const currentTool = computed(() => findTool(route.path))
const menuItems = computed(() => [
  { key: '/', label: '工具首页', icon: () => h(AppstoreOutlined) },
  { type: 'divider' as const },
  ...tools.map((tool) => ({ key: tool.path, label: tool.shortName, icon: () => h(tool.icon) })),
])
const themeConfig = computed(() => ({
  algorithm: isDark.value ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: primaryColor.value,
    borderRadius: 8,
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorBgLayout: isDark.value ? '#111513' : '#f3f5f2',
  },
}))

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
          <a-menu class="side-menu" mode="inline" :items="menuItems" :selected-keys="selectedKeys" @click="navigate" />
          <div class="sider-foot">
            <span class="privacy-dot" />
            <span>本地优先处理</span>
          </div>
        </a-layout-sider>

        <a-drawer v-model:open="drawerOpen" placement="left" :width="286" :closable="false" class="mobile-drawer">
          <router-link to="/" class="brand drawer-brand" @click="drawerOpen = false">
            <span class="brand-mark"><ToolOutlined /></span>
            <span><strong>LittleTools</strong><small>轻量浏览器工具箱</small></span>
          </router-link>
          <a-menu mode="inline" :items="menuItems" :selected-keys="selectedKeys" @click="navigate" />
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
              <a-tag v-if="isOffline" class="offline-tag"><DisconnectOutlined /> <span>离线模式</span></a-tag>
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
                        @click="primaryColor = color"
                      />
                      <label class="custom-color" title="自定义主题色">
                        <BgColorsOutlined />
                        <input v-model="primaryColor" type="color" />
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
              <router-view />
              <footer class="app-footer">LittleTools · 数据优先在你的浏览器中处理</footer>
            </main>
          </a-layout-content>
        </a-layout>
      </a-layout>
    </a-app>
  </a-config-provider>
</template>
