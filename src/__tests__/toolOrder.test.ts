import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { tools } from '../config/tools'

const storageKey = 'little-tools:v1:tool-order'
const defaults = tools.map((tool) => tool.key)
let values: Map<string, string>
let storage: Pick<Storage, 'getItem' | 'setItem'>

async function loadOrder() {
  const { useToolOrder } = await import('../composables/useToolOrder')
  return useToolOrder()
}

beforeEach(() => {
  vi.resetModules()
  values = new Map()
  storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', new EventTarget())
})

afterEach(() => vi.unstubAllGlobals())

describe('persistent tool order', () => {
  it('moves tools in both directions and restores the exact order after reload', async () => {
    const state = await loadOrder()
    state.moveTool(defaults[0]!, defaults.length - 1)
    state.moveTool(defaults[3]!, 0)
    const expected = [...defaults]
    expected.push(expected.shift()!)
    expected.splice(expected.indexOf(defaults[3]!), 1)
    expected.unshift(defaults[3]!)
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual(expected)
    expect(JSON.parse(values.get(storageKey)!)).toEqual(expected)
    vi.resetModules()
    expect((await loadOrder()).orderedTools.value.map((tool) => tool.key)).toEqual(expected)
  })

  it('shares changes between consumers and persists a reset without erasing other settings', async () => {
    values.set('little-tools:v1:password', '{"length":24}')
    const first = await loadOrder()
    const second = await loadOrder()
    first.moveTool(defaults[1]!, 0)
    expect(second.orderedTools.value[0]!.key).toBe(defaults[1])
    expect(second.hasCustomOrder.value).toBe(true)
    second.resetOrder()
    expect(first.orderedTools.value.map((tool) => tool.key)).toEqual(defaults)
    expect(first.hasCustomOrder.value).toBe(false)
    expect(JSON.parse(values.get(storageKey)!)).toEqual(defaults)
    expect(values.get('little-tools:v1:password')).toBe('{"length":24}')
  })

  it.each(['broken JSON', 'null', '{}', '"password"', '42'])('falls back safely for invalid saved data: %s', async (saved) => {
    values.set(storageKey, saved)
    expect((await loadOrder()).orderedTools.value.map((tool) => tool.key)).toEqual(defaults)
  })

  it('removes unknown and duplicate keys and appends new tools without losing preferences', async () => {
    values.set(storageKey, JSON.stringify([defaults[2], 'removed-tool', defaults[0], defaults[2], null, 7]))
    const state = await loadOrder()
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual([
      defaults[2], defaults[0], ...defaults.filter((key) => key !== defaults[2] && key !== defaults[0]),
    ])
  })

  it('ignores invalid moves and clamps moves at the ends', async () => {
    const state = await loadOrder()
    state.moveTool('unknown', 0)
    state.moveTool(defaults[0]!, Number.NaN)
    state.moveTool(defaults[0]!, 1.5)
    state.moveTool(defaults[0]!, -1)
    expect(storage.setItem).not.toHaveBeenCalled()
    state.moveTool(defaults[0]!, 100)
    expect(state.orderedTools.value.at(-1)!.key).toBe(defaults[0])
    state.moveTool(defaults[0]!, -100)
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual(defaults)
  })

  it('keeps sorting usable when storage is unavailable and reports failed writes', async () => {
    vi.mocked(storage.getItem).mockImplementation(() => { throw new Error('Blocked') })
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error('Quota exceeded') })
    const state = await loadOrder()
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual(defaults)
    state.moveTool(defaults[1]!, 0)
    expect(state.orderedTools.value[0]!.key).toBe(defaults[1])
    expect(state.storageFailed.value).toBe(true)
    vi.mocked(storage.setItem).mockImplementation((key, value) => { values.set(key, value) })
    state.resetOrder()
    expect(state.storageFailed.value).toBe(false)
  })

  it('syncs changes and clears from other tabs without writing back, and cleans up listeners', async () => {
    const { useToolOrder } = await import('../composables/useToolOrder')
    const scope = effectScope()
    const state = scope.run(() => useToolOrder())!
    const sendStorageEvent = (key: string | null, newValue: string | null, area = storage) => {
      window.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea: area }))
    }
    sendStorageEvent(storageKey, JSON.stringify([...defaults].reverse()))
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual([...defaults].reverse())
    sendStorageEvent('unrelated-key', 'null')
    sendStorageEvent(storageKey, 'null', { getItem: () => null, setItem: () => {} })
    expect(state.orderedTools.value[0]!.key).toBe(defaults.at(-1))
    sendStorageEvent(null, null)
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual(defaults)
    expect(storage.setItem).not.toHaveBeenCalled()
    scope.stop()
    sendStorageEvent(storageKey, JSON.stringify([...defaults].reverse()))
    expect(state.orderedTools.value.map((tool) => tool.key)).toEqual(defaults)
  })
})
