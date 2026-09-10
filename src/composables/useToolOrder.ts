import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import { tools } from '../config/tools'

export const TOOL_ORDER_STORAGE_KEY = 'little-tools:v1:tool-order'
const defaultKeys = tools.map((tool) => tool.key)
const toolByKey = new Map(tools.map((tool) => [tool.key, tool]))

function normalizeOrder(saved: unknown): string[] {
  const knownKeys = Array.isArray(saved)
    ? saved.filter((key): key is string => typeof key === 'string' && toolByKey.has(key))
    : []
  // Keep existing preferences when tools are added or removed in a new release.
  return [...new Set([...knownKeys, ...defaultKeys])]
}

function parseOrder(value: string | null): string[] {
  try { return normalizeOrder(JSON.parse(value || 'null')) }
  catch { return [...defaultKeys] }
}

function readOrder(): string[] {
  try { return parseOrder(localStorage.getItem(TOOL_ORDER_STORAGE_KEY)) }
  catch { return [...defaultKeys] }
}

const order = ref(readOrder())
const storageFailed = ref(false)
const announcement = ref('')
const orderedTools = computed(() => order.value.map((key) => toolByKey.get(key)!))
const hasCustomOrder = computed(() => order.value.some((key, index) => key !== defaultKeys[index]))
let consumers = 0

function saveOrder(keys: string[]) {
  order.value = keys
  try {
    localStorage.setItem(TOOL_ORDER_STORAGE_KEY, JSON.stringify(keys))
    storageFailed.value = false
  } catch {
    storageFailed.value = true
  }
}

function moveTool(key: string, targetIndex: number) {
  const from = order.value.indexOf(key)
  if (from === -1 || !Number.isInteger(targetIndex)) return
  const to = Math.max(0, Math.min(targetIndex, order.value.length - 1))
  if (from === to) return
  const keys = [...order.value]
  keys.splice(from, 1)
  keys.splice(to, 0, key)
  saveOrder(keys)
  announcement.value = `${toolByKey.get(key)!.name}已移至第 ${to + 1} 项。${storageFailed.value ? '浏览器未能保存顺序。' : '顺序已保存。'}`
}

function resetOrder() {
  saveOrder([...defaultKeys])
  announcement.value = storageFailed.value ? '已恢复默认顺序，但浏览器未能保存。' : '已恢复默认顺序并保存。'
}

function syncOrder(event: StorageEvent) {
  if (event.key !== TOOL_ORDER_STORAGE_KEY && event.key !== null) return
  try { if (event.storageArea !== localStorage) return }
  catch { return }
  order.value = parseOrder(event.newValue)
  storageFailed.value = false
}

export function useToolOrder() {
  if (getCurrentScope() && typeof window !== 'undefined') {
    if (consumers++ === 0) window.addEventListener('storage', syncOrder)
    onScopeDispose(() => {
      if (--consumers === 0) window.removeEventListener('storage', syncOrder)
    })
  }

  return {
    orderedTools,
    hasCustomOrder,
    storageFailed: computed(() => storageFailed.value),
    orderAnnouncement: computed(() => announcement.value),
    moveTool,
    resetOrder,
  }
}
