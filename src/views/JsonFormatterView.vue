<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { CheckOutlined, ClearOutlined, CodeSandboxOutlined, CompressOutlined, CopyOutlined, DownloadOutlined, FormatPainterOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import JsonTreeNode from '../components/JsonTreeNode.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { minifyJson, parseJson, stringifyJson, utf8Size, type JsonParseResult } from '../utils/json'

const example = `{
  "project": "LittleTools",
  "version": 1,
  "features": [
    { "name": "JSON 格式化", "enabled": true },
    { "name": "树形视图", "enabled": true }
  ],
  "settings": {
    "theme": "auto",
    "offline": true,
    "limits": null
  }
}`

const source = ref(example)
const indent = ref<'2' | '4' | 'tab'>('2')
const result = shallowRef<JsonParseResult>(parseJson(source.value))
const editorContainer = ref<HTMLElement | null>(null)
const copied = ref(false)
const expansionMode = ref<'all' | 'none' | 'default'>('default')
const controlVersion = ref(0)
const treeRevision = ref(0)
let parseTimer = 0

rememberToolSettings('json-formatter', { source, indent })

watch(source, () => {
  window.clearTimeout(parseTimer)
  parseTimer = window.setTimeout(() => parseNow(), 220)
})
onBeforeUnmount(() => window.clearTimeout(parseTimer))

const validResult = computed(() => result.value.ok ? result.value : null)
const bytes = computed(() => utf8Size(source.value))
const minifiedBytes = computed(() => validResult.value ? utf8Size(minifyJson(validResult.value.value)) : 0)
const typeSummary = computed(() => {
  if (!validResult.value) return []
  const stats = validResult.value.stats
  return [
    { label: '节点', value: stats.nodes },
    { label: '键', value: stats.keys },
    { label: '对象', value: stats.objects },
    { label: '数组', value: stats.arrays },
    { label: '最大层级', value: stats.maxDepth },
  ]
})

function parseNow() {
  result.value = parseJson(source.value)
  if (result.value.ok) treeRevision.value += 1
  return result.value
}

function formatSource() {
  const parsed = parseNow()
  if (!parsed.ok) { focusError(); return }
  source.value = stringifyJson(parsed.value, indent.value)
  result.value = parseJson(source.value)
  treeRevision.value += 1
}

function minifySource() {
  const parsed = parseNow()
  if (!parsed.ok) { focusError(); return }
  source.value = minifyJson(parsed.value)
  result.value = parseJson(source.value)
  treeRevision.value += 1
}

function setExpansion(mode: 'all' | 'none' | 'default') {
  expansionMode.value = mode
  controlVersion.value += 1
}

function focusError() {
  if (result.value.ok) return
  const textarea = editorContainer.value?.querySelector('textarea')
  textarea?.focus()
  textarea?.setSelectionRange(result.value.issue.offset, result.value.issue.offset + result.value.issue.length)
}

async function copySource() {
  await navigator.clipboard.writeText(source.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1500)
}

function download() {
  if (!result.value.ok) return
  const blob = new Blob([source.value], { type: 'application/json;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'formatted.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

function loadExample() {
  source.value = example
  result.value = parseJson(example)
  treeRevision.value += 1
}
</script>

<template>
  <ToolPageHeader title="JSON 格式化与树形查看" description="本地格式化、压缩和校验 JSON，并以可展开的树形结构浏览" :icon="CodeSandboxOutlined" color="#4c6f8d" />

  <ToolCard class="json-workbench">
    <div class="json-toolbar">
      <a-button type="primary" @click="formatSource"><FormatPainterOutlined /> 格式化</a-button>
      <a-button @click="minifySource"><CompressOutlined /> 压缩</a-button>
      <a-button @click="parseNow"><CheckOutlined /> 校验</a-button>
      <a-select v-model:value="indent" class="indent-select" aria-label="缩进方式">
        <a-select-option value="2">2 空格缩进</a-select-option>
        <a-select-option value="4">4 空格缩进</a-select-option>
        <a-select-option value="tab">Tab 缩进</a-select-option>
      </a-select>
      <span class="toolbar-spacer" />
      <a-button type="text" @click="loadExample">载入示例</a-button>
      <a-button type="text" :disabled="!source" @click="copySource"><CopyOutlined /> {{ copied ? '已复制' : '复制' }}</a-button>
      <a-button type="text" :disabled="!result.ok" @click="download"><DownloadOutlined /> 下载</a-button>
      <a-button type="text" danger @click="source = ''; parseNow()"><ClearOutlined /> 清空</a-button>
    </div>

    <div class="json-panes">
      <section class="editor-pane">
        <div class="pane-heading">
          <div><strong>JSON 文本</strong><span>{{ source.length.toLocaleString() }} 字符 · {{ bytes.toLocaleString() }} 字节</span></div>
          <span v-if="result.ok" class="valid-mark"><CheckOutlined /> 语法正确</span>
          <button v-else class="error-mark" @click="focusError">第 {{ result.issue.line }} 行，第 {{ result.issue.column }} 列</button>
        </div>
        <div ref="editorContainer" class="json-editor" :class="{ invalid: !result.ok }">
          <a-textarea v-model:value="source" :rows="26" spellcheck="false" placeholder="粘贴 JSON 文本" />
        </div>

        <div v-if="!result.ok" class="json-error-panel">
          <div class="error-title"><strong>{{ result.issue.message }}</strong><button @click="focusError">定位错误</button></div>
          <span>错误代码：{{ result.issue.code }} · Offset {{ result.issue.offset }}</span>
          <pre><code>{{ result.issue.lineText || ' ' }}</code>
<code class="caret">{{ result.issue.caret }}</code></pre>
        </div>
      </section>

      <section class="tree-pane">
        <div class="pane-heading tree-heading">
          <div><strong>树形视图</strong><span v-if="result.ok">点击括号或箭头展开、收起</span></div>
          <div class="tree-actions">
            <a-button size="small" @click="setExpansion('all')">全部展开</a-button>
            <a-button size="small" @click="setExpansion('none')">全部收起</a-button>
            <a-button size="small" @click="setExpansion('default')">默认层级</a-button>
          </div>
        </div>

        <div v-if="result.ok" class="tree-stats">
          <span v-for="item in typeSummary" :key="item.label"><small>{{ item.label }}</small><b>{{ item.value }}</b></span>
          <span><small>压缩后</small><b>{{ minifiedBytes.toLocaleString() }} B</b></span>
        </div>

        <div class="json-tree-wrap">
          <JsonTreeNode
            v-if="result.ok"
            :key="treeRevision"
            :value="result.value"
            :depth="0"
            path="$"
            :expansion-mode="expansionMode"
            :control-version="controlVersion"
          />
          <div v-else class="tree-empty">
            <CodeSandboxOutlined />
            <strong>修正 JSON 后显示树形结构</strong>
            <span>左侧会指出首个语法错误的位置</span>
          </div>
        </div>
      </section>
    </div>

    <div class="notice">JSON 内容只在浏览器本地解析和缓存，不会上传到服务器。特别大的文本可能超出浏览器本地存储配额，但仍可在当前页面正常处理。</div>
  </ToolCard>
</template>

<style scoped>
.json-workbench { padding: 0; overflow: hidden; }
.json-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.toolbar-spacer { flex: 1 1 auto; }
.indent-select { width: 145px; }
.json-panes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 650px; }
.editor-pane, .tree-pane { min-width: 0; }
.editor-pane { border-right: 1px solid var(--line); }
.pane-heading { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 16px; border-bottom: 1px solid var(--line); background: var(--panel-subtle); }
.pane-heading > div:first-child { display: flex; flex-direction: column; }
.pane-heading strong { color: var(--text-main); font-size: 13px; }
.pane-heading span { margin-top: 3px; color: var(--text-muted); font-size: 10px; }
.valid-mark, .error-mark { flex: 0 0 auto; }
.valid-mark { color: #397755 !important; font-size: 11px !important; }
.error-mark { padding: 4px 7px; border: 0; border-radius: 5px; background: color-mix(in srgb, #b74e4e 10%, transparent); color: #b74e4e; font-size: 10px; cursor: pointer; }
.json-editor :deep(textarea) { min-height: 590px !important; padding: 15px; resize: vertical; border: 0; border-radius: 0; box-shadow: none !important; font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; line-height: 1.65; tab-size: 2; }
.json-editor.invalid :deep(textarea) { background: color-mix(in srgb, #b74e4e 2.5%, var(--panel-bg)); }
.json-error-panel { margin: 0 14px 14px; padding: 13px; border: 1px solid color-mix(in srgb, #b74e4e 25%, var(--line)); border-radius: 8px; background: color-mix(in srgb, #b74e4e 6%, var(--panel-bg)); }
.error-title { display: flex; justify-content: space-between; gap: 12px; }
.error-title strong { color: #b74e4e; font-size: 12px; }
.error-title button { padding: 0; border: 0; background: transparent; color: var(--primary-color); font-size: 11px; cursor: pointer; }
.json-error-panel > span { display: block; margin-top: 4px; color: var(--text-muted); font-size: 10px; }
.json-error-panel pre { margin: 10px 0 0; padding: 9px 10px; overflow: auto; border-radius: 6px; background: var(--panel-subtle); font-size: 11px; line-height: 1.45; }
.json-error-panel code { display: block; white-space: pre; }
.json-error-panel .caret { color: #b74e4e; }
.tree-heading { flex-wrap: wrap; }
.tree-actions { display: flex !important; flex-flow: row wrap !important; gap: 5px; }
.tree-stats { display: flex; flex-wrap: wrap; gap: 1px; padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--line); }
.tree-stats > span { display: flex; min-width: 72px; flex: 1 1 auto; align-items: baseline; justify-content: space-between; gap: 7px; margin: 0; padding: 7px 9px; background: var(--panel-bg); }
.tree-stats small { color: var(--text-muted); font-size: 9px; }
.tree-stats b { color: var(--text-main); font-family: monospace; font-size: 11px; }
.json-tree-wrap { min-height: 540px; max-height: 720px; padding: 10px 7px 20px; overflow: auto; background: var(--panel-bg); }
.tree-empty { display: flex; min-height: 500px; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); text-align: center; }
.tree-empty > :first-child { margin-bottom: 12px; font-size: 28px; }
.tree-empty strong { color: var(--text-main); font-size: 13px; }
.tree-empty span { margin-top: 5px; font-size: 11px; }
.json-workbench > .notice { margin: 0 16px 16px; }
@media (max-width: 980px) { .json-panes { grid-template-columns: 1fr; } .editor-pane { border-right: 0; border-bottom: 1px solid var(--line); } .json-editor :deep(textarea) { min-height: 420px !important; } .json-tree-wrap { min-height: 420px; } }
@media (max-width: 640px) { .json-toolbar > .ant-btn { flex: 1 1 auto; } .toolbar-spacer { display: none; } .indent-select { width: 100%; } .pane-heading { align-items: flex-start; } .tree-actions { flex-basis: 100%; } }
</style>
