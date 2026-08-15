<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  description: string
  icon: Component
  color?: string
}>()
</script>

<template>
  <header class="tool-page-header">
    <div class="tool-page-title-row">
      <span class="tool-page-icon" :style="{ '--tool-color': color || 'var(--primary-color)' }">
        <component :is="icon" />
      </span>
      <div>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
    </div>
    <div v-if="$slots.extra" class="tool-page-extra">
      <slot name="extra" />
    </div>
  </header>
</template>
