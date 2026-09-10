import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { useRegexLibrary } from '../composables/useRegexLibrary'
import { emptyDocument } from '../utils/regex'
let storage: Map<string, string>, scopes: EffectScope[]
function open() { const scope = effectScope(); scopes.push(scope); return scope.run(useRegexLibrary)! }
beforeEach(() => { storage = new Map(); scopes = []; vi.useFakeTimers(); vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }) })
afterEach(() => { scopes.forEach((scope) => scope.stop()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })
describe('regex local pattern library', () => {
  it('saves a clean document and updates the same record after reload', async () => {
    const first = open()
    expect(first.save()).toBe(true)
    expect(JSON.stringify(first.document.value)).toBe(JSON.stringify(first.saved.value[0]!.document))
    first.flush()
    const restored = open()
    expect(restored.currentId.value).toBe(first.currentId.value)
    restored.document.value.name = 'Updated'
    expect(restored.save()).toBe(true)
    expect(restored.saved.value).toHaveLength(1)
    expect(restored.saved.value[0]!.document.name).toBe('Updated')
    await nextTick()
  })
  it('forks independently and persists favorites', async () => {
    const library = open()
    library.save()
    const id = library.currentId.value!
    library.toggleFavorite(id)
    library.document.value.name = 'Copy'
    library.save(true)
    expect(library.saved.value).toHaveLength(2)
    expect(library.saved.value[1]!.document.name).not.toBe('Copy')
    expect(open().favorites.value).toEqual([id])
    await nextTick()
  })
  it('validates every imported document before writing any records', async () => {
    const library = open()
    expect(() => library.importDocuments({ patterns: [emptyDocument(), { bad: true }] })).toThrow()
    expect(library.saved.value).toEqual([])
    expect(library.importDocuments(emptyDocument())).toBe(1)
    expect(library.saved.value).toHaveLength(1)
    await nextTick()
  })
  it('keeps the current document usable when storage is corrupt or full', async () => {
    storage.set('little-tools:v1:regex-draft', 'broken JSON')
    const library = open()
    expect(library.document.value.pattern).toContain('user')
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota') } })
    expect(library.save()).toBe(false)
    expect(library.saved.value).toEqual([])
    expect(library.storageError.value).toContain('尚未持久保存')
    await nextTick()
  })
})
