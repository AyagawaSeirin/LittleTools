<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <section class="tool-card">
    <div v-if="title || description" class="tool-card-heading">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <slot />
  </section>
</template>
