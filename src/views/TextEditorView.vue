<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ClearOutlined, CopyOutlined, EditOutlined, RedoOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, isolateHistory, redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { openSearchPanel, search, SearchQuery, setSearchQuery } from '@codemirror/search'
import { findTextMatch, textReplacementChanges } from '../utils/textEditor'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'

// Deliberately omit rememberToolSettings: document, query and history are ephemeral.
const editorHost = ref<HTMLElement | null>(null)
const searchPanelHost = shallowRef<HTMLElement | null>(null)
const searchInput = ref<{ focus: () => void; select: () => void } | null>(null)
const searchText = ref('')
const replacement = ref('')
const regexp = ref(false)
const caseSensitive = ref(false)
const lineWrapping = ref(true)
const characters = ref(0)
const lines = ref(1)
const cursor = ref({ line: 1, column: 1 })
const selectedCharacters = ref(0)
const canUndo = ref(false)
const canRedo = ref(false)
const matches = shallowRef<{ from: number; to: number }[]>([])
const matchesTruncated = ref(false)
const selection = shallowRef({ from: 0, to: 0 })
const feedback = ref('')
const copyError = ref('')
const wrapping = new Compartment()
let editor: EditorView | undefined
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

const query = computed(() => new SearchQuery({
  search: searchText.value,
  replace: replacement.value,
  regexp: regexp.value,
  caseSensitive: caseSensitive.value,
  literal: !regexp.value,
}))
const invalidRegex = computed(() => Boolean(searchText.value && regexp.value && !query.value.valid))
const activeMatch = computed(() => matches.value.findIndex((match) => match.from === selection.value.from && match.to === selection.value.to))
const searchStatus = computed(() => {
  if (!searchText.value) return '输入搜索内容'
  if (invalidRegex.value) return '正则表达式无效'
  if (!matches.value.length) return '没有匹配结果'
  const total = `${matches.value.length.toLocaleString()}${matchesTruncated.value ? '+' : ''}`
  return activeMatch.value < 0 ? `${total} 处匹配` : `${activeMatch.value + 1} / ${total} 处匹配`
})

function updateMatches(state: EditorState) {
  const found: { from: number; to: number }[] = []
  matchesTruncated.value = false
  if (query.value.valid) {
    const cursor = query.value.getCursor(state)
    for (let result = cursor.next(); !result.done; result = cursor.next()) {
      // Bound the status index for large documents; search and replace still cover the full text.
      if (found.length === 10000) { matchesTruncated.value = true; break }
      found.push({ from: result.value.from, to: result.value.to })
    }
  }
  matches.value = found
}

function updateStatus(state: EditorState) {
  const main = state.selection.main
  const line = state.doc.lineAt(main.head)
  lines.value = state.doc.lines
  cursor.value = { line: line.number, column: Array.from(state.sliceDoc(line.from, main.head)).length + 1 }
  selection.value = { from: main.from, to: main.to }
  selectedCharacters.value = Array.from(state.sliceDoc(main.from, main.to)).length
  canUndo.value = undoDepth(state) > 0
  canRedo.value = redoDepth(state) > 0
}

function focusSearch() {
  searchInput.value?.focus()
  searchInput.value?.select()
  return true
}

function announce(message: string) {
  clearTimeout(feedbackTimer)
  feedback.value = message
  feedbackTimer = setTimeout(() => { feedback.value = '' }, 2500)
}

function navigateMatch(direction: -1 | 1) {
  if (!editor || !query.value.valid) return false
  const match = findTextMatch(editor.state, query.value, editor.state.selection.main, direction)
  if (!match) return false
  editor.dispatch({ selection: EditorSelection.range(match.from, match.to), effects: EditorView.scrollIntoView(match.from, { y: 'center' }) })
  return true
}

function replaceCurrent() {
  if (!editor || !query.value.valid || !matches.value.length) return
  let changes = textReplacementChanges(editor.state, query.value, editor.state.selection.main)
  if (!changes.length) {
    navigateMatch(1)
    changes = textReplacementChanges(editor.state, query.value, editor.state.selection.main)
  }
  const change = changes[0]
  if (!change) return
  editor.dispatch({ changes, selection: EditorSelection.range(change.from, change.from + editor.state.toText(change.insert).length), annotations: isolateHistory.of('full'), userEvent: 'input.replace' })
  navigateMatch(1)
  announce('已替换当前匹配，可撤销')
}

function replaceEveryMatch() {
  if (!editor || !query.value.valid || !matches.value.length) return
  const changes = textReplacementChanges(editor.state, query.value)
  if (!changes.length) return
  editor.dispatch({ changes, annotations: isolateHistory.of('full'), userEvent: 'input.replace.all' })
  announce(`已替换 ${changes.length.toLocaleString()} 处匹配，可撤销`)
}

function undoEdit() { if (editor) { undo(editor); editor.focus() } }
function redoEdit() { if (editor) { redo(editor); editor.focus() } }

function clearText() {
  if (!editor) return
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: '' },
    selection: EditorSelection.cursor(0),
    annotations: isolateHistory.of('full'),
    userEvent: 'delete',
  })
  editor.focus()
  announce('已清空文本，可撤销')
}

async function copyText() {
  if (!editor?.state.doc.length) return
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(editor.state.doc.toString())
    // A pending clipboard request may complete after this page has been unmounted.
    if (editor) announce('已复制全文')
  } catch {
    if (editor) copyError.value = '无法访问剪贴板，请在编辑区全选后手动复制。'
  }
}

watch(query, (current, previous) => {
  if (!editor) return
  editor.dispatch({ effects: setSearchQuery.of(current) })
  updateMatches(editor.state)
  if (current.search !== previous.search || current.regexp !== previous.regexp || current.caseSensitive !== previous.caseSensitive) {
    const first = matches.value[0]
    if (first) editor.dispatch({ selection: EditorSelection.range(first.from, first.to), effects: EditorView.scrollIntoView(first.from, { y: 'center' }) })
  }
  feedback.value = ''
})

watch(lineWrapping, (enabled) => editor?.dispatch({ effects: wrapping.reconfigure(enabled ? EditorView.lineWrapping : []) }))

onMounted(() => {
  if (!editorHost.value) return
  const panel = document.createElement('div')
  panel.className = 'text-search-panel'
  searchPanelHost.value = panel
  editor = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(),
        wrapping.of(EditorView.lineWrapping),
        placeholder('在这里输入或粘贴文本…'),
        EditorView.contentAttributes.of({ 'aria-label': '文本编辑区', 'aria-multiline': 'true', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off' }),
        EditorState.phrases.of({
          'current match': '当前匹配', 'on line': '所在行',
          'replaced match on line $': '已替换第 $ 行的匹配', 'replaced $ matches': '已替换 $ 处匹配',
        }),
        search({ literal: true, createPanel: () => ({ dom: panel, top: true }) }),
        keymap.of([
          { key: 'Mod-f', run: focusSearch, preventDefault: true },
          { key: 'Mod-h', run: focusSearch, preventDefault: true },
          { key: 'F3', run: () => navigateMatch(1), shift: () => navigateMatch(-1), preventDefault: true },
          { key: 'Mod-g', run: () => navigateMatch(1), shift: () => navigateMatch(-1), preventDefault: true },
          ...historyKeymap, ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
              characters.value += Array.from(inserted.toString()).length - Array.from(update.startState.sliceDoc(fromA, toA)).length
            })
            updateMatches(update.state)
            feedback.value = ''
            copyError.value = ''
          }
          updateStatus(update.state)
        }),
      ],
    }),
  })
  openSearchPanel(editor)
})

onBeforeUnmount(() => {
  clearTimeout(feedbackTimer)
  editor?.destroy()
  editor = undefined
  searchPanelHost.value = null
})
</script>

<template>
  <ToolPageHeader title="在线文本编辑器" description="自由编辑文本，支持普通搜索、正则表达式与批量替换" :icon="EditOutlined" />
  <ToolCard class="text-workbench">
    <div class="editor-toolbar">
      <a-button :disabled="!canUndo" aria-label="撤销" @click="undoEdit"><UndoOutlined /> 撤销</a-button>
      <a-button :disabled="!canRedo" aria-label="重做" @click="redoEdit"><RedoOutlined /> 重做</a-button>
      <a-checkbox v-model:checked="lineWrapping">自动换行</a-checkbox>
      <span class="toolbar-spacer" />
      <a-button :disabled="!characters" aria-label="复制全文" @click="copyText"><CopyOutlined /> 复制全文</a-button>
      <a-button :disabled="!characters" danger aria-label="清空文本" @click="clearText"><ClearOutlined /> 清空</a-button>
    </div>

    <div ref="editorHost" class="text-editor" />

    <Teleport v-if="searchPanelHost" :to="searchPanelHost">
      <div class="search-controls" @keydown.esc.prevent="editor?.focus()">
        <div class="search-row">
          <label for="editor-search">搜索</label>
          <a-input id="editor-search" ref="searchInput" v-model:value="searchText" main-field="true" class="search-field" aria-label="搜索文本" :aria-invalid="invalidRegex" :status="invalidRegex ? 'error' : undefined" :placeholder="regexp ? '正则表达式，例如 (\\d+)' : '输入要查找的文本'" autocomplete="off" spellcheck="false" allow-clear @press-enter="navigateMatch($event.shiftKey ? -1 : 1)" />
          <div class="search-actions">
            <a-button :disabled="!matches.length" @click="navigateMatch(-1)">上一个</a-button>
            <a-button :disabled="!matches.length" @click="navigateMatch(1)">下一个</a-button>
          </div>
        </div>
        <div class="search-row">
          <label for="editor-replace">替换</label>
          <a-input id="editor-replace" v-model:value="replacement" class="search-field" aria-label="替换文本" placeholder="留空可删除匹配内容" autocomplete="off" spellcheck="false" allow-clear @press-enter="replaceCurrent" />
          <div class="search-actions">
            <a-button :disabled="!matches.length" @click="replaceCurrent">替换当前</a-button>
            <a-button :disabled="!matches.length" @click="replaceEveryMatch">全部替换</a-button>
          </div>
        </div>
        <div class="search-options">
          <a-checkbox v-model:checked="caseSensitive">区分大小写</a-checkbox>
          <a-checkbox v-model:checked="regexp">正则表达式</a-checkbox>
          <span class="search-status" :class="{ 'search-error': invalidRegex }" role="status">{{ searchStatus }}</span>
        </div>
        <p v-if="invalidRegex" class="search-error regex-help" role="alert">请检查正则表达式的括号、转义符等语法，无需在两端添加斜杠。</p>
        <p v-else-if="regexp" class="regex-help">直接输入表达式；替换支持 <code>$1</code>、<code>$2</code> 分组、<code>$&amp;</code> 完整匹配，以及 <code>\n</code> 换行、<code>\t</code> 制表符。</p>
      </div>
    </Teleport>

    <div class="editor-status">
      <span>{{ characters.toLocaleString() }} 字符 · {{ lines.toLocaleString() }} 行</span>
      <span>第 {{ cursor.line }} 行，第 {{ cursor.column }} 列<span v-if="selectedCharacters"> · 已选 {{ selectedCharacters.toLocaleString() }} 字符</span></span>
      <span class="edit-feedback" role="status">{{ feedback }}</span>
    </div>
    <a-alert v-if="copyError" type="error" show-icon :message="copyError" />
    <p class="notice privacy-note">所有编辑与搜索均在本地完成，正文、搜索词和替换内容不会上传或保存。刷新、关闭页面或切换工具后清空。</p>
    <p class="editor-shortcuts">Ctrl / ⌘ + F 搜索 · Enter / Shift + Enter 切换匹配 · Ctrl / ⌘ + Z 撤销</p>
  </ToolCard>
</template>

<style scoped>
.editor-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; }
.editor-toolbar > .ant-checkbox-wrapper { margin-inline-start: 8px; }
.toolbar-spacer { flex: 1; }
.text-editor { overflow: hidden; border: 1px solid var(--line); border-radius: 6px; }
.text-editor :deep(.cm-editor) { height: clamp(460px, 68vh, 920px); background: var(--panel-bg); color: var(--text-main); outline: none; }
.text-editor :deep(.cm-scroller) { overflow: auto; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 14px; line-height: 1.7; }
.text-editor :deep(.cm-content) { padding-block: 12px; caret-color: var(--text-main); }
.text-editor :deep(.cm-content:focus-visible) { outline: none; }
.text-editor :deep(.cm-line) { padding-inline: 12px; }
.text-editor :deep(.cm-gutters) { border-color: var(--line); background: var(--panel-subtle); color: var(--text-muted); }
.text-editor :deep(.cm-lineNumbers .cm-gutterElement) { min-width: 42px; padding-inline: 8px; }
/* CodeMirror draws selection below the text, so the active line must stay translucent. */
.text-editor :deep(.cm-activeLine) { background: color-mix(in srgb, var(--text-muted) 7%, transparent); }
.text-editor :deep(.cm-activeLineGutter) { background: var(--panel-subtle); }
.text-editor :deep(.cm-placeholder) { color: var(--text-muted); }
.text-editor :deep(.cm-cursor) { border-left-color: var(--text-main); }
.text-editor :deep(.cm-selectionBackground), .text-editor :deep(.cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground) { background: color-mix(in srgb, var(--accent-text) 24%, var(--panel-bg)); }
.text-editor :deep(.cm-searchMatch) { background: color-mix(in srgb, #ce9d25 24%, transparent); }
.text-editor :deep(.cm-searchMatch-selected) { background: color-mix(in srgb, var(--accent-text) 25%, transparent); outline: 1px solid var(--accent-text); }
.text-editor :deep(.cm-panels) { background: var(--panel-subtle); color: var(--text-main); border-color: var(--line); }
.search-controls { padding: 14px; font-family: var(--font-sans); }
.search-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) 184px; align-items: center; gap: 10px; margin-bottom: 10px; }
.search-row > label { font-size: 13px; }
.search-field { min-width: 0; }
.search-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.search-actions .ant-btn { padding-inline: 8px; }
.search-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.search-status { margin-inline-start: auto; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.search-error { color: var(--error-text); }
.regex-help { margin: 8px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.regex-help.search-error { color: var(--error-text); }
.regex-help code { font-family: "SFMono-Regular", Consolas, monospace; }
.editor-status { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; min-height: 38px; padding-block: 8px; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.edit-feedback { margin-inline-start: auto; color: var(--accent-text); }
.privacy-note { margin: 12px 0 0; }
.editor-shortcuts { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
@container (max-width: 560px) {
  .search-row { grid-template-columns: 32px minmax(0, 1fr); gap: 8px; }
  .search-actions { grid-column: 2; }
  .search-controls { padding: 12px; }
  .search-status { flex-basis: 100%; margin-inline-start: 0; }
  .toolbar-spacer { display: none; }
  .editor-toolbar > .ant-checkbox-wrapper { margin-inline-start: 0; }
  .text-editor :deep(.cm-editor) { height: max(640px, 78vh); }
}
</style>
