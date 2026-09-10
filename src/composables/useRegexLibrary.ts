import { ref, watch } from 'vue'
import { emptyDocument, exampleDocument, makeId, validateDocument, type RegexDocument } from '../utils/regex'
export interface SavedRegex { id: string; updatedAt: string; document: RegexDocument }
const DRAFT_KEY = 'little-tools:v1:regex-draft', LIBRARY_KEY = 'little-tools:v1:regex-library', FAVORITES_KEY = 'little-tools:v1:regex-favorites'
export function useRegexLibrary() {
  const document = ref<RegexDocument>(exampleDocument()), saved = ref<SavedRegex[]>([]), favorites = ref<string[]>([]), currentId = ref<string | null>(null), storageError = ref('')
  function read(key: string) { try { return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown } catch { storageError.value = '部分本地记录无法读取，当前编辑仍可使用。可导出 JSON 备份。'; return null } }
  const draft = read(DRAFT_KEY)
  const draftRecord = draft && typeof draft === 'object' && 'document' in draft ? draft as { document: unknown; currentId?: unknown } : null
  try { if (draft) document.value = validateDocument(draftRecord ? draftRecord.document : draft) } catch { storageError.value = '本地草稿格式无效，已载入示例。' }
  const items = read(LIBRARY_KEY)
  if (Array.isArray(items)) {
    for (const item of items.slice(0, 100)) try {
      if (typeof item?.id === 'string' && typeof item?.updatedAt === 'string') saved.value.push({ id: item.id, updatedAt: item.updatedAt, document: validateDocument(item.document) })
    } catch { storageError.value = '模式库中有损坏记录，已跳过。' }
  }
  if (typeof draftRecord?.currentId === 'string' && saved.value.some((item) => item.id === draftRecord.currentId)) currentId.value = draftRecord.currentId
  const stars = read(FAVORITES_KEY)
  if (Array.isArray(stars)) favorites.value = stars.filter((s) => typeof s === 'string').slice(0, 500)
  function persist(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { storageError.value = '本地存储不可用或空间已满，当前更改尚未持久保存。请导出 JSON 文件备份。'; return false } }
  let draftTimer: ReturnType<typeof setTimeout> | undefined
  function flush() { clearTimeout(draftTimer); persist(DRAFT_KEY, { document: document.value, currentId: currentId.value }) }
  watch([document, currentId], () => { clearTimeout(draftTimer); draftTimer = setTimeout(flush, 350) }, { deep: true })
  function load(value: RegexDocument, id: string | null = null) { document.value = validateDocument(value); currentId.value = id }
  function create() { load(emptyDocument()) }
  function save(asCopy = false) {
    const validated = validateDocument(document.value)
    const id = !asCopy && currentId.value ? currentId.value : makeId()
    const record = { id, updatedAt: new Date().toISOString(), document: validated }
    const next = [record, ...saved.value.filter((item) => item.id !== id)]
    if (next.length > 100) throw new Error('模式库最多保存 100 项，请导出备份后移除不需要的项目。')
    if (!persist(LIBRARY_KEY, next)) return false
    saved.value = next; document.value = validateDocument(validated); currentId.value = id
    return true
  }
  function remove(id: string) { const next = saved.value.filter((item) => item.id !== id); if (persist(LIBRARY_KEY, next)) { saved.value = next; if (currentId.value === id) currentId.value = null } }
  function toggleFavorite(id: string) { const next = favorites.value.includes(id) ? favorites.value.filter((s) => s !== id) : [...favorites.value, id]; if (persist(FAVORITES_KEY, next)) favorites.value = next }
  function importDocuments(value: unknown) {
    const raw = value && typeof value === 'object' && 'patterns' in value ? (value as { patterns: unknown }).patterns : [value]
    if (!Array.isArray(raw) || !raw.length || raw.length > 100) throw new Error('导入文件应为正则文档，或最多包含 100 个文档的模式库。')
    const records = raw.map((item) => ({ id: makeId(), updatedAt: new Date().toISOString(), document: validateDocument(item) }))
    if (saved.value.length + records.length > 100) throw new Error('导入后超过 100 项，请先整理模式库。')
    const next = [...records, ...saved.value]
    if (!persist(LIBRARY_KEY, next)) throw new Error(storageError.value)
    saved.value = next
    load(records[0]!.document, records[0]!.id)
    return records.length
  }
  return { document, saved, favorites, currentId, storageError, load, create, save, remove, toggleFavorite, importDocuments, flush }
}
