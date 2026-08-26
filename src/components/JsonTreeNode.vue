<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CaretRightOutlined } from '@ant-design/icons-vue'

defineOptions({ name: 'JsonTreeNode' })

const props = defineProps<{
  value: unknown
  nodeKey?: string | number
  depth: number
  path: string
  expansionMode: 'all' | 'none' | 'default'
  controlVersion: number
  searchQuery: string
  matchingPaths: string[]
  activeMatchPath: string
}>()

const isArray = computed(() => Array.isArray(props.value))
const isObject = computed(() => props.value !== null && typeof props.value === 'object' && !isArray.value)
const isContainer = computed(() => isArray.value || isObject.value)
const entries = computed(() => isContainer.value ? Object.entries(props.value as Record<string, unknown>) : [])
const isSearchMatch = computed(() => props.matchingPaths.includes(props.path))
const isActiveMatch = computed(() => props.activeMatchPath === props.path)
const containsSearchMatch = computed(() => props.matchingPaths.some((matchPath) => (
  matchPath === props.path || matchPath.startsWith(`${props.path}.`) || matchPath.startsWith(`${props.path}[`)
)))
const containsActiveMatch = computed(() => Boolean(props.activeMatchPath) && (
  props.activeMatchPath === props.path || props.activeMatchPath.startsWith(`${props.path}.`) || props.activeMatchPath.startsWith(`${props.path}[`)
))

function expansionForCurrentState() {
  if (props.expansionMode === 'all') return true
  if (props.searchQuery.trim() && containsSearchMatch.value) return true
  return props.expansionMode === 'default' && props.depth < 2
}

const expanded = ref(expansionForCurrentState())

watch(() => props.controlVersion, () => {
  expanded.value = expansionForCurrentState()
})

watch([() => props.searchQuery, containsSearchMatch], ([query, hasMatch]) => {
  if (query.trim() && hasMatch) expanded.value = true
  else if (!query.trim()) expanded.value = expansionForCurrentState()
})

watch(() => props.activeMatchPath, () => {
  if (containsActiveMatch.value) expanded.value = true
})

const opening = computed(() => isArray.value ? '[' : '{')
const closing = computed(() => isArray.value ? ']' : '}')
const typeClass = computed(() => props.value === null ? 'null' : typeof props.value)
const scalarText = computed(() => typeof props.value === 'string' ? JSON.stringify(props.value) : props.value === null ? 'null' : String(props.value))
const countLabel = computed(() => `${entries.value.length} ${isArray.value ? '项' : '个键'}`)

function childPath(key: string) {
  if (isArray.value) return `${props.path}[${key}]`
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${props.path}.${key}` : `${props.path}[${JSON.stringify(key)}]`
}
</script>

<template>
  <div class="json-node" :class="{ container: isContainer }">
    <div
      class="json-node-row"
      :class="{ 'search-match': isSearchMatch, 'active-match': isActiveMatch }"
      :style="{ '--depth': depth }"
      :title="path"
      :data-json-path="path"
      :aria-current="isActiveMatch ? 'true' : undefined"
    >
      <button v-if="isContainer" class="tree-toggle" :aria-label="expanded ? '收起节点' : '展开节点'" @click="expanded = !expanded">
        <CaretRightOutlined :class="{ expanded }" />
      </button>
      <span v-else class="tree-spacer" />
      <span v-if="nodeKey !== undefined" class="json-key">{{ isArray ? `[${nodeKey}]` : JSON.stringify(String(nodeKey)) }}</span>
      <span v-if="nodeKey !== undefined" class="json-colon">:</span>
      <template v-if="isContainer">
        <button class="container-label" @click="expanded = !expanded">
          <code>{{ opening }}</code>
          <span>{{ countLabel }}</span>
          <code v-if="!expanded">{{ closing }}</code>
        </button>
      </template>
      <code v-else class="json-value" :class="`type-${typeClass}`">{{ scalarText }}</code>
    </div>

    <div v-if="isContainer && expanded" class="json-children">
      <JsonTreeNode
        v-for="([key, item], index) in entries"
        :key="`${path}-${key}`"
        :value="item"
        :node-key="isArray ? index : key"
        :depth="depth + 1"
        :path="childPath(key)"
        :expansion-mode="expansionMode"
        :control-version="controlVersion"
        :search-query="searchQuery"
        :matching-paths="matchingPaths"
        :active-match-path="activeMatchPath"
      />
      <div class="json-close-row" :style="{ '--depth': depth }"><code>{{ closing }}</code></div>
    </div>
  </div>
</template>

<style scoped>
.json-node-row, .json-close-row { display: flex; min-height: 29px; align-items: flex-start; padding-left: calc(var(--depth) * 20px); font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; line-height: 29px; }
.json-node-row:hover { background: color-mix(in srgb, var(--primary-color) 5%, transparent); }
.json-node-row.search-match { background: color-mix(in srgb, #d8a22d 17%, var(--panel-bg)); box-shadow: inset 3px 0 #d8a22d; }
.json-node-row.active-match { background: color-mix(in srgb, var(--primary-color) 17%, var(--panel-bg)); box-shadow: inset 3px 0 var(--primary-color); }
.tree-toggle, .tree-spacer { display: grid; flex: 0 0 22px; width: 22px; height: 29px; padding: 0; place-items: center; border: 0; background: transparent; color: var(--text-muted); font-size: 10px; }
.tree-toggle { cursor: pointer; }
.tree-toggle :deep(svg) { transition: transform .14s ease; }
.tree-toggle :deep(.expanded svg), .tree-toggle .expanded { transform: rotate(90deg); }
.json-key { color: #386f90; overflow-wrap: anywhere; }
:global(:root[data-theme='dark']) .json-key { color: #7daec8; }
.json-colon { margin: 0 6px 0 3px; color: var(--text-muted); }
.container-label { display: inline-flex; height: 29px; align-items: center; gap: 7px; padding: 0; border: 0; background: transparent; color: var(--text-main); cursor: pointer; }
.container-label span { color: var(--text-muted); font-family: inherit; font-size: 10px; }
.json-value { max-width: min(100%, 900px); overflow-wrap: anywhere; white-space: pre-wrap; }
.type-string { color: #51733d; }
.type-number { color: #936025; }
.type-boolean { color: #81518e; }
.type-null { color: var(--text-muted); font-style: italic; }
:global(:root[data-theme='dark']) .type-string { color: #8fbd73; }
:global(:root[data-theme='dark']) .type-number { color: #d5a362; }
:global(:root[data-theme='dark']) .type-boolean { color: #bd8dca; }
.json-close-row { color: var(--text-main); }
@media (max-width: 640px) { .json-node-row, .json-close-row { padding-left: calc(var(--depth) * 14px); } }
</style>
