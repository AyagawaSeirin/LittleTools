<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, drawSelection, highlightActiveLineGutter, hoverTooltip, keymap, lineNumbers, placeholder, type DecorationSet } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, isolateHistory, redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import type { RegexMatch } from '../utils/regex'
import type { RegexToken } from '../utils/regexExplain'

const props = withDefaults(defineProps<{ modelValue: string; label: string; kind?: 'pattern' | 'text' | 'output'; matches?: RegexMatch[]; tokens?: RegexToken[]; activeMatch?: number; focusRange?: { from: number; to: number } | null }>(), { kind: 'text', matches: () => [], tokens: () => [], activeMatch: -1, focusRange: null })
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'history': [state: { undo: boolean; redo: boolean }]; 'match': [index: number]; 'selection': [text: string] }>()
const host = ref<HTMLElement | null>(null)
let editor: EditorView | undefined, external = false
const decorate = StateEffect.define<DecorationSet>()
const marks = StateField.define<DecorationSet>({ create: () => Decoration.none, update(value, transaction) { if (transaction.docChanged) value = Decoration.none; for (const effect of transaction.effects) if (effect.is(decorate)) value = effect.value; return value }, provide: (field) => EditorView.decorations.from(field) })
class ZeroMatch extends WidgetType {
  constructor(readonly index: number, readonly active: boolean) { super() }
  toDOM() { const span = document.createElement('span'); span.className = `regex-zero${this.active ? ' active' : ''}`; span.textContent = '▏'; span.title = `匹配 ${this.index + 1}：零宽匹配`; return span }
  eq(other: ZeroMatch) { return this.index === other.index && this.active === other.active }
}
function refreshDecorations() {
  if (!editor) return
  const length = editor.state.doc.length
  const ranges = []
  if (props.kind === 'pattern') {
    for (const token of props.tokens) if (token.from < token.to && token.to <= length) ranges.push(Decoration.mark({ class: `regex-token-${token.kind}` }).range(token.from, token.to))
  } else {
    props.matches.forEach((match, index) => {
      if (match.from < 0 || match.to > length) return
      if (match.from === match.to) ranges.push(Decoration.widget({ widget: new ZeroMatch(index, index === props.activeMatch), side: 1 }).range(match.from))
      else ranges.push(Decoration.mark({ class: `regex-match ${index % 2 ? 'alternate' : ''}${index === props.activeMatch ? ' active' : ''}` }).range(match.from, match.to))
    })
  }
  const focus = props.focusRange
  if (focus && focus.from < focus.to && focus.from >= 0 && focus.to <= length) ranges.push(Decoration.mark({ class: 'regex-focus-range' }).range(focus.from, focus.to))
  editor.dispatch({ effects: decorate.of(Decoration.set(ranges, true)) })
}
function selectRange(from: number, to: number, focus = true) {
  if (!editor) return
  from = Math.max(0, Math.min(from, editor.state.doc.length)); to = Math.max(from, Math.min(to, editor.state.doc.length))
  editor.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'center' }) })
  if (focus) editor.focus()
}
function insert(value: string) {
  if (!editor) return
  editor.dispatch({ ...editor.state.replaceSelection(value), annotations: isolateHistory.of('full'), userEvent: 'input' })
  editor.focus()
}
function undoEdit() { if (editor) { undo(editor); editor.focus() } }
function redoEdit() { if (editor) { redo(editor); editor.focus() } }
function scrollMatch(index: number) { const match = props.matches[index]; if (match) selectRange(match.from, match.to, false) }
defineExpose({ insert, undo: undoEdit, redo: redoEdit, selectRange, scrollMatch })
const tooltip = hoverTooltip((_view, position) => {
  let title = '', description = '', from = position, to = position
  if (props.kind === 'pattern') {
    const token = props.tokens.filter((t) => t.from <= position && position < t.to).sort((a, b) => a.to - a.from - (b.to - b.from))[0]
    if (!token) return null
    title = token.label; description = token.description; from = token.from; to = token.to
  } else {
    const index = props.matches.findIndex((m) => position >= m.from && (position < m.to || m.from === m.to && position === m.to))
    const match = props.matches[index]
    if (!match) return null
    title = `匹配 ${index + 1} · 位置 ${match.from}–${match.to} · 长度 ${match.to - match.from}`
    description = [match.value || '（零宽匹配）', ...match.groups.map((g, i) => `分组 ${i + 1}: ${g === null ? '未参与匹配' : g === '' ? '（空字符串）' : g}`)].join('\n').slice(0, 2000)
    from = match.from; to = match.to
  }
  return { pos: from, end: to, above: true, create() { const dom = document.createElement('div'), strong = document.createElement('strong'), body = document.createElement('div'); dom.className = 'regex-tooltip'; strong.textContent = title; body.textContent = description; dom.append(strong, body); return { dom } } }
})
watch(() => props.modelValue, (value) => {
  if (!editor || editor.state.doc.toString() === value) return
  external = true
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, annotations: isolateHistory.of('full'), userEvent: 'input.replace' })
  external = false
  refreshDecorations()
})
watch(() => [props.matches, props.tokens, props.activeMatch, props.focusRange], refreshDecorations)
onMounted(() => {
  if (!host.value) return
  const extensions: Extension[] = [
    EditorState.lineSeparator.of('\n'), marks, history(), drawSelection(), tooltip, keymap.of([...historyKeymap, ...searchKeymap, ...defaultKeymap]),
    EditorView.lineWrapping, placeholder(props.kind === 'pattern' ? '输入正则表达式，无需 / 分隔符' : '在这里输入或粘贴测试文本…'),
    EditorView.contentAttributes.of({ 'aria-label': props.label, spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !external) emit('update:modelValue', update.state.doc.toString())
      emit('history', { undo: undoDepth(update.state) > 0, redo: redoDepth(update.state) > 0 })
      if (update.selectionSet) {
        const { from, to } = update.state.selection.main
        emit('selection', update.state.sliceDoc(from, to))
        if (props.kind === 'text') { const index = props.matches.findIndex((m) => from >= m.from && from <= m.to); if (index >= 0) emit('match', index) }
      }
    }),
    EditorView.theme({ '&': { backgroundColor: 'var(--panel-bg)', color: 'var(--text-main)' }, '.cm-content': { caretColor: 'var(--text-main)' }, '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-main)' }, '.cm-gutters': { backgroundColor: 'var(--panel-subtle)', color: 'var(--text-muted)', borderRight: '1px solid var(--line)' }, '.cm-activeLineGutter': { backgroundColor: 'var(--page-bg)' }, '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in srgb, var(--primary-color) 25%, transparent) !important' } }),
  ]
  if (props.kind !== 'pattern') extensions.push(lineNumbers(), highlightActiveLineGutter(), search({ top: true }), highlightSelectionMatches())
  if (props.kind === 'output') extensions.push(EditorState.readOnly.of(true))
  editor = new EditorView({ parent: host.value, state: EditorState.create({ doc: props.modelValue, extensions }) })
  refreshDecorations()
})
onBeforeUnmount(() => { editor?.destroy(); editor = undefined })
</script>

<template><div ref="host" class="regex-code-editor" :class="kind" /></template>

<style scoped>
.regex-code-editor { min-width: 0; }
.regex-code-editor :deep(.cm-editor) { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.regex-code-editor :deep(.cm-scroller) { min-height: 290px; max-height: 540px; overflow: auto; line-height: 1.85; }
.regex-code-editor :deep(.cm-content) { padding: 16px 8px; }
.regex-code-editor :deep(.cm-line) { padding-inline: 8px; }
.regex-code-editor :deep(.cm-focused) { outline: none; }
.regex-code-editor:focus-within { box-shadow: inset 0 -2px var(--accent-text); }
.pattern :deep(.cm-scroller) { min-height: 70px; max-height: 190px; font-size: 16px; line-height: 1.8; }
.pattern :deep(.cm-content) { padding: 17px 0; }
.output :deep(.cm-scroller) { min-height: 160px; max-height: 320px; }
.regex-code-editor :deep(.regex-match) { background: color-mix(in srgb, var(--primary-color) 20%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--accent-text) 70%, transparent); }
.regex-code-editor :deep(.regex-match.alternate) { background: color-mix(in srgb, var(--primary-color) 32%, transparent); }
.regex-code-editor :deep(.regex-match.active), .regex-code-editor :deep(.regex-focus-range) { background: color-mix(in srgb, var(--primary-color) 40%, transparent); outline: 1px solid var(--accent-text); }
.regex-code-editor :deep(.regex-zero) { display: inline-block; width: 2px; overflow: visible; color: var(--accent-text); font-weight: 700; }
.regex-code-editor :deep(.regex-zero.active) { color: var(--error-text); }
.regex-code-editor :deep(.regex-token-class) { color: #2463b0; }
.regex-code-editor :deep(.regex-token-group) { color: #7653a9; }
.regex-code-editor :deep(.regex-token-quantifier) { color: #aa5724; }
.regex-code-editor :deep(.regex-token-assertion), .regex-code-editor :deep(.regex-token-alternation) { color: #a53b60; }
.regex-code-editor :deep(.regex-token-literal) { color: var(--text-main); }
.regex-code-editor :deep(.regex-token-comment) { color: var(--text-muted); }
:global([data-theme='dark'] .regex-token-class) { color: #91bff6; }
:global([data-theme='dark'] .regex-token-group) { color: #c6a7ec; }
:global([data-theme='dark'] .regex-token-quantifier) { color: #edb17c; }
:global([data-theme='dark'] .regex-token-assertion), :global([data-theme='dark'] .regex-token-alternation) { color: #eca7be; }
.regex-code-editor :deep(.cm-tooltip) { max-width: min(430px, calc(100vw - 36px)); border: 1px solid var(--line); background: var(--panel-bg); color: var(--text-main); }
.regex-code-editor :deep(.regex-tooltip) { padding: 10px 12px; font-family: var(--font-sans); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.regex-code-editor :deep(.regex-tooltip strong) { display: block; margin-bottom: 5px; }
.regex-code-editor :deep(.cm-panels) { background: var(--panel-subtle); color: var(--text-main); }
.regex-code-editor :deep(.cm-search) { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 28px 8px 10px; }
.regex-code-editor :deep(.cm-search input) { max-width: 100%; background: var(--panel-bg); color: var(--text-main); border: 1px solid var(--line); }
</style>
