<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CodeOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, LeftOutlined, PlusOutlined, RedoOutlined, RightOutlined, SaveOutlined, SearchOutlined, ShareAltOutlined, StarFilled, StarOutlined, UndoOutlined, UploadOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import RegexCodeEditor from '../components/RegexCodeEditor.vue'
import { useRegexLibrary } from '../composables/useRegexLibrary'
import { useRegexWorker } from '../composables/useRegexWorker'
import { decodeDocument, encodeDocument, makeId, regexFlags, TEST_LIMIT, type RegexDocument, type RegexEngine } from '../utils/regex'
import { explainRegex, type RegexToken } from '../utils/regexExplain'
import { referenceFor, type RegexReference } from '../data/regexReference'
import { regexExamples } from '../data/regexExamples'

const route = useRoute()
const library = useRegexLibrary()
const { document: doc, saved, favorites, currentId, storageError } = library
const { result, busy, run, stop } = useRegexWorker()
const patternEditor = ref<InstanceType<typeof RegexCodeEditor> | null>(null), textEditor = ref<InstanceType<typeof RegexCodeEditor> | null>(null)
const patternHistory = ref({ undo: false, redo: false }), textHistory = ref({ undo: false, redo: false })
const contentTab = ref('text'), toolTab = ref('details'), sideTab = ref('cheatsheet'), sidebarOpen = ref(true), toolsOpen = ref(true)
const activeMatch = ref(0), visibleMatches = ref(50), selectedText = ref(''), search = ref(''), libraryFilter = ref('all')
const selectedReference = ref<RegexReference | null>(null), expressionFocus = ref<{ from: number; to: number } | null>(null), textFocus = ref<{ from: number; to: number } | null>(null)
const feedback = ref(''), actionError = ref(''), settingsOpen = ref(false), shareOpen = ref(false), shareText = ref(true), shareTests = ref(true), shareUrl = ref('')
const literalOpen = ref(false), literalInput = ref(''), literalError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
const contentTabs = [{ value: 'text', label: '测试文本' }, { value: 'tests', label: '测试集' }]
const toolTabs = [{ value: 'details', label: '匹配详情' }, { value: 'replace', label: '替换' }, { value: 'list', label: '提取列表' }, { value: 'explain', label: '表达式解释' }, { value: 'code', label: '代码' }]
const sideTabs = [{ value: 'cheatsheet', label: '速查' }, { value: 'reference', label: '参考' }, { value: 'patterns', label: '模式库' }, { value: 'help', label: '帮助' }]
const testModes = [{ value: 'full', label: '完整匹配' }, { value: 'partial', label: '包含匹配' }, { value: 'none', label: '不应匹配' }, { value: 'count', label: '匹配次数' }]
const flags = computed(() => regexFlags.filter((f) => f.engines.includes(doc.value.engine)))
const explanation = computed(() => explainRegex(doc.value.pattern, doc.value.flags, doc.value.engine))
const currentMatch = computed(() => result.value.matches[activeMatch.value])
const testResults = computed(() => new Map(result.value.tests.map((test) => [test.id, test])))
const testSummary = computed(() => `${result.value.tests.filter((test) => test.passed).length} / ${doc.value.tests.length} 项通过`)
const matchStatus = computed(() => busy.value ? '正在匹配…' : result.value.error ? '表达式未完成匹配' : result.value.matches.length ? `${result.value.matches.length.toLocaleString()}${result.value.truncated ? '+' : ''} 处匹配` : '没有匹配')
const output = computed(() => toolTab.value === 'list' ? result.value.list : result.value.replacement)
const outputDisabled = computed(() => busy.value || Boolean(result.value.error || result.value.outputError))
const dirty = computed(() => {
  const existing = saved.value.find((item) => item.id === currentId.value)
  return !existing || JSON.stringify(existing.document) !== JSON.stringify(doc.value)
})
const references = computed(() => {
  const query = search.value.trim().toLowerCase()
  return referenceFor(doc.value.engine).filter((item) => (sideTab.value !== 'cheatsheet' || ['字符与字符集', '锚点与边界', '分组与引用', '环视断言', '量词与分支'].includes(item.category)) && (!query || [item.title, item.syntax, item.description, item.category].some((s) => s.toLowerCase().includes(query))))
})
const categories = computed(() => [...new Set(references.value.map((ref) => ref.category))])
const patterns = computed(() => {
  const query = search.value.trim().toLowerCase()
  const all = [...saved.value.map((item) => ({ ...item, local: true })), ...regexExamples.map((item) => ({ ...item, local: false, updatedAt: '' }))]
  return all.filter((item) => (libraryFilter.value !== 'saved' || item.local) && (libraryFilter.value !== 'examples' || !item.local) && (libraryFilter.value !== 'favorites' || favorites.value.includes(item.id)) && (!query || [item.document.name, item.document.description, item.document.tags, item.document.author, item.document.pattern].some((s) => s.toLowerCase().includes(query))))
})
function literal(pattern: string) {
  let output = '', slashes = 0
  for (const char of pattern) {
    output += char === '/' && slashes % 2 === 0 ? '\\/' : char === '\n' && doc.value.engine === 'javascript' ? '\\n' : char === '\r' && doc.value.engine === 'javascript' ? '\\r' : char
    slashes = char === '\\' ? slashes + 1 : 0
  }
  return `/${output}/${doc.value.flags}`
}
const expressionLiteral = computed(() => literal(doc.value.pattern))
const generatedCode = computed(() => {
  if (doc.value.engine === 'javascript') return `const regex = new RegExp(${JSON.stringify(doc.value.pattern)}, ${JSON.stringify(doc.value.flags)});\nconst text = ${JSON.stringify(doc.value.text)};\n\n// 匹配\n${doc.value.flags.includes('g') ? 'const matches = [...text.matchAll(regex)];' : 'const match = regex.exec(text);'}\nconsole.log(${doc.value.flags.includes('g') ? 'matches' : 'match'});\n\n// 原生 JavaScript 替换模板\nregex.lastIndex = 0;\nconst replaced = text.replace(regex, ${JSON.stringify(doc.value.replacement.replace(/\\([nrt\\])/g, (_, c: string) => ({ n: '\n', r: '\r', t: '\t', '\\': '\\' }[c]!)))});\nconsole.log(replaced);`
  const phpString = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return `<?php\n$pattern = ${phpString(expressionLiteral.value.replace(/g(?=[a-zA-Z]*$)/, ''))};\n$text = ${phpString(doc.value.text)};\n\n${doc.value.flags.includes('g') ? 'preg_match_all' : 'preg_match'}($pattern, $text, $matches${doc.value.flags.includes('g') ? ', PREG_SET_ORDER' : ''});\nprint_r($matches);\n\n// PHP 的替换语法使用 $1 或 \\1，不支持工具的命名模板。\n// 示例：用 [matched] 替换匹配文本。\n$result = preg_replace($pattern, '[matched]', $text${doc.value.flags.includes('g') ? '' : ', 1'});\necho $result;`
})
function announce(message: string) { clearTimeout(feedbackTimer); feedback.value = message; feedbackTimer = setTimeout(() => { feedback.value = '' }, 3000) }
function errorMessage(error: unknown) { actionError.value = error instanceof Error ? error.message : String(error) }
async function copy(value: string, label = '内容') { try { actionError.value = ''; await navigator.clipboard.writeText(value); announce(`已复制${label}`) } catch { actionError.value = '无法访问剪贴板，请选中内容后手动复制。' } }
function save(asCopy = false) { try { actionError.value = ''; if (library.save(asCopy)) announce(asCopy ? '已另存为本地副本' : '已保存到我的模式') } catch (error) { errorMessage(error) } }
function toggleFlag(flag: string) {
  const next = new Set(doc.value.flags)
  if (next.has(flag)) next.delete(flag)
  else { next.add(flag); if (flag === 'u') next.delete('v'); if (flag === 'v') next.delete('u') }
  doc.value.flags = regexFlags.filter((item) => next.has(item.flag)).map((item) => item.flag).join('')
}
function changeEngine(engine: RegexEngine) {
  const allowed = regexFlags.filter((flag) => flag.engines.includes(engine)).map((flag) => flag.flag)
  const removed = [...doc.value.flags].filter((flag) => !allowed.includes(flag))
  doc.value.engine = engine
  doc.value.flags = [...doc.value.flags].filter((flag) => allowed.includes(flag)).join('')
  if (engine === 'pcre' && !doc.value.flags.includes('u')) doc.value.flags += 'u'
  if (removed.length) announce(`已移除该引擎不支持的修饰符：${removed.join('、')}`)
}
function navigateMatch(direction: number) {
  const count = result.value.matches.length
  if (!count) return
  activeMatch.value = (activeMatch.value + direction + count) % count
  textFocus.value = null
  textEditor.value?.scrollMatch(activeMatch.value)
}
function chooseMatch(index: number) { activeMatch.value = index; textFocus.value = null; textEditor.value?.scrollMatch(index) }
function addTest(fromSelection = false) {
  if (doc.value.tests.length >= TEST_LIMIT) { actionError.value = '测试集最多支持 200 项。'; return }
  doc.value.tests.push({ id: makeId(), name: `测试 ${doc.value.tests.length + 1}`, text: fromSelection ? selectedText.value : '', mode: 'partial', count: 1 })
  contentTab.value = 'tests'
}
function inspectToken(token: RegexToken) { expressionFocus.value = { from: token.from, to: token.to }; patternEditor.value?.selectRange(token.from, token.to, false) }
function showReference(item: RegexReference) { selectedReference.value = item }
function openTokenReference(token: RegexToken) { sideTab.value = 'reference'; sidebarOpen.value = true; selectedReference.value = referenceFor(doc.value.engine).find((ref) => ref.id === token.reference) ?? null }
function insertReference() {
  const item = selectedReference.value
  if (!item) return
  if (item.category === '替换与提取') { toolTab.value = 'replace'; toolsOpen.value = true; doc.value.replacement += item.insert }
  else patternEditor.value?.insert(item.insert)
}
function loadPattern(document: RegexDocument, id: string | null = null) { library.load(document, id); selectedReference.value = null; announce('已载入模式') }
function download(value: string, filename: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([value], { type: `${type};charset=utf-8` }))
  const link = window.document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportDocument(all = false) { download(JSON.stringify(all ? { version: 1, patterns: saved.value.map((item) => item.document) } : doc.value, null, 2), all ? 'regex-library.json' : 'regex-pattern.json', 'application/json') }
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 6_000_000) throw new Error('导入文件不能超过 6 MB。')
    const count = library.importDocuments(JSON.parse(await file.text()))
    announce(`已导入 ${count} 个模式`); sideTab.value = 'patterns'; libraryFilter.value = 'saved'; sidebarOpen.value = true
  } catch (error) { errorMessage(error) }
  finally { input.value = '' }
}
function createShare() {
  try {
    actionError.value = ''
    const document = { ...doc.value, text: shareText.value ? doc.value.text : '', tests: shareTests.value ? doc.value.tests : [] }
    const url = new URL(window.location.href); url.search = ''; url.hash = `/regex-tester?r=${encodeDocument(document)}`
    shareUrl.value = url.toString()
  } catch (error) { errorMessage(error) }
}
function importLiteral() {
  const value = literalInput.value.trim(), end = value.lastIndexOf('/')
  if (!value.startsWith('/') || end <= 0 || !/^[a-zA-Z]*$/.test(value.slice(end + 1))) { literalError.value = '请输入 /表达式/修饰符，例如 /\\d+/gi。'; return }
  const pattern = value.slice(1, end), flags = value.slice(end + 1)
  const allowed = regexFlags.filter((flag) => flag.engines.includes(doc.value.engine)).map((flag) => flag.flag)
  if ([...flags].some((flag) => !allowed.includes(flag)) || new Set(flags).size !== flags.length || flags.includes('u') && flags.includes('v')) { literalError.value = '修饰符无效、重复或与当前引擎不兼容。'; return }
  doc.value.pattern = pattern; doc.value.flags = flags; literalOpen.value = false
}
function keyboard(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(event.shiftKey) } }
function beforeUnload() { library.flush() }
watch(() => route.query.r, (value) => {
  if (typeof value !== 'string') return
  try { library.load(decodeDocument(value)); announce('已从分享链接载入模式') } catch (error) { errorMessage(error) }
}, { immediate: true })
watch(() => [doc.value.engine, doc.value.pattern, doc.value.flags, doc.value.text, doc.value.replacement, doc.value.listTemplate, doc.value.tests], () => {
  activeMatch.value = 0; visibleMatches.value = 50; textFocus.value = null; expressionFocus.value = null
  run(doc.value)
}, { deep: true, immediate: true })
watch([shareText, shareTests, doc], () => { shareUrl.value = '' }, { deep: true })
watch(sideTab, () => { search.value = ''; selectedReference.value = null })
watch(contentTab, async (tab) => { if (tab === 'text') { await nextTick(); window.dispatchEvent(new Event('resize')) } })
onMounted(() => { window.addEventListener('keydown', keyboard); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { library.flush(); clearTimeout(feedbackTimer); window.removeEventListener('keydown', keyboard); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <ToolPageHeader title="正则表达式测试与编辑" description="实时匹配、分组解析、替换提取与测试集，支持 JavaScript / PCRE2" :icon="CodeOutlined" />
  <ToolCard class="regex-workbench">
    <div class="document-toolbar">
      <a-input v-model:value="doc.name" class="document-name" aria-label="表达式名称" :maxlength="200" />
      <span class="save-state">{{ currentId && !dirty ? '已保存' : '草稿' }}</span>
      <span class="spacer" />
      <a-button type="primary" @click="save()"><SaveOutlined /> 保存</a-button>
      <a-button @click="save(true)">另存为</a-button>
      <a-button @click="shareOpen = true; shareUrl = ''"><ShareAltOutlined /> 分享</a-button>
      <a-button @click="library.create()"><PlusOutlined /> 新建</a-button>
      <a-dropdown>
        <a-button aria-label="更多模式操作">更多</a-button>
        <template #overlay><a-menu>
          <a-menu-item @click="settingsOpen = true">模式信息</a-menu-item>
          <a-menu-item @click="fileInput?.click()"><UploadOutlined /> 导入 JSON</a-menu-item>
          <a-menu-item @click="exportDocument()"><DownloadOutlined /> 导出当前模式</a-menu-item>
          <a-menu-item :disabled="!saved.length" @click="exportDocument(true)">导出我的模式库</a-menu-item>
        </a-menu></template>
      </a-dropdown>
      <input ref="fileInput" class="visually-hidden" type="file" tabindex="-1" accept=".json,application/json" aria-label="导入模式文件" @change="importFile" />
    </div>
    <div v-if="feedback" class="feedback" role="status">{{ feedback }}</div>
    <div v-if="actionError || storageError" class="action-error" role="alert"><span>{{ actionError || storageError }}</span><a-button size="small" type="text" @click="actionError = ''; storageError = ''">关闭提示</a-button></div>
    <div class="regex-layout" :class="{ 'sidebar-hidden': !sidebarOpen }">
      <div class="regex-main">
        <section class="expression-section" aria-label="表达式设置">
          <div class="section-heading expression-heading">
            <strong>表达式</strong>
            <select :value="doc.engine" aria-label="正则引擎" class="native-select" @change="changeEngine(($event.target as HTMLSelectElement).value as RegexEngine)"><option value="javascript">JavaScript</option><option value="pcre">PHP / PCRE2</option></select>
            <span class="spacer" />
            <a-button size="small" type="text" :disabled="!patternHistory.undo" aria-label="撤销表达式" @click="patternEditor?.undo()"><UndoOutlined /></a-button>
            <a-button size="small" type="text" :disabled="!patternHistory.redo" aria-label="重做表达式" @click="patternEditor?.redo()"><RedoOutlined /></a-button>
            <a-button size="small" type="text" @click="literalOpen = true; literalError = ''">导入 /…/</a-button>
            <a-button size="small" type="text" aria-label="复制表达式" @click="copy(expressionLiteral, '表达式')"><CopyOutlined /></a-button>
            <a-button size="small" type="text" :aria-expanded="sidebarOpen" @click="sidebarOpen = !sidebarOpen">{{ sidebarOpen ? '收起参考' : '展开参考' }}</a-button>
          </div>
          <div class="expression-editor-row">
            <span class="delimiter" aria-hidden="true">/</span>
            <RegexCodeEditor ref="patternEditor" v-model="doc.pattern" label="正则表达式" kind="pattern" :tokens="explanation.tokens" :focus-range="expressionFocus" @history="patternHistory = $event" />
            <span class="delimiter closing" aria-hidden="true">/ <small>{{ doc.flags }}</small></span>
          </div>
          <div class="flags-row"><span>修饰符</span><a-tooltip v-for="flag in flags" :key="flag.flag" :title="`${flag.name}：${flag.description}`"><button class="flag-button" :class="{ selected: doc.flags.includes(flag.flag) }" :aria-label="`${flag.flag} ${flag.name}`" :aria-pressed="doc.flags.includes(flag.flag)" @click="toggleFlag(flag.flag)">{{ flag.flag }}</button></a-tooltip><span class="flags-help">悬停查看说明</span></div>
          <div v-if="result.error" class="regex-error" role="alert"><strong>{{ result.error }}</strong><button v-if="result.errorOffset !== undefined" @click="patternEditor?.selectRange(result.errorOffset, result.errorOffset + 1)">定位错误：第 {{ result.errorOffset + 1 }} 个位置</button></div>
        </section>
        <section aria-label="正则测试">
          <div class="section-heading test-heading">
            <div class="tab-row" role="tablist" aria-label="测试模式"><button v-for="tab in contentTabs" :id="`regex-${tab.value}-tab`" :key="tab.value" role="tab" :aria-selected="contentTab === tab.value" :aria-controls="`regex-${tab.value}-panel`" :class="{ selected: contentTab === tab.value }" @click="contentTab = tab.value">{{ tab.label }}<small v-if="tab.value === 'tests'">{{ doc.tests.length }}</small></button></div>
            <span class="spacer" /><span class="match-status" aria-live="polite">{{ contentTab === 'tests' && !busy && !result.error ? testSummary : matchStatus }}</span><span v-if="!busy && !result.error" class="elapsed">{{ result.elapsed.toFixed(1) }} ms</span>
          </div>
          <div v-show="contentTab === 'text'" id="regex-text-panel" role="tabpanel" aria-labelledby="regex-text-tab">
            <div class="text-toolbar">
              <a-button size="small" type="text" :disabled="!textHistory.undo" @click="textEditor?.undo()"><UndoOutlined /> 撤销文本</a-button>
              <a-button size="small" type="text" :disabled="!textHistory.redo" @click="textEditor?.redo()"><RedoOutlined /> 重做</a-button>
              <span class="spacer" />
              <a-button size="small" type="text" :disabled="!selectedText" @click="addTest(true)">选区转为测试</a-button>
              <a-button size="small" type="text" :disabled="!doc.text" aria-label="复制测试文本" @click="copy(doc.text, '测试文本')"><CopyOutlined /></a-button>
              <a-button size="small" type="text" :disabled="!doc.text" @click="doc.text = ''">清空文本</a-button>
            </div>
            <RegexCodeEditor ref="textEditor" v-model="doc.text" label="正则测试文本" :matches="result.matches" :active-match="activeMatch" :focus-range="textFocus" @history="textHistory = $event" @match="activeMatch = $event" @selection="selectedText = $event" />
            <div class="editor-status"><span>{{ doc.text.length.toLocaleString() }} 个 UTF-16 单元 · {{ doc.text.split('\n').length.toLocaleString() }} 行</span><span>点击匹配查看分组；悬停查看详情</span></div>
          </div>
          <div v-show="contentTab === 'tests'" id="regex-tests-panel" class="tests-panel" role="tabpanel" aria-labelledby="regex-tests-tab">
            <div class="test-actions"><a-button size="small" @click="addTest()"><PlusOutlined /> 添加测试</a-button><span>完整匹配检查整个文本；每项测试从起点独立运行。</span></div>
            <div v-if="!doc.tests.length" class="empty-state">添加预期能匹配或不能匹配的文本，建立回归测试集。</div>
            <div v-for="(test, index) in doc.tests" :key="test.id" class="test-case">
              <div class="test-case-heading"><span class="test-number">{{ index + 1 }}</span><a-input v-model:value="test.name" :aria-label="`测试 ${index + 1} 名称`" :maxlength="200" size="small" /><select v-model="test.mode" :aria-label="`测试 ${index + 1} 类型`" class="native-select"><option v-for="mode in testModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option></select><a-input-number v-if="test.mode === 'count'" v-model:value="test.count" :min="0" :max="5000" :precision="0" size="small" :aria-label="`测试 ${index + 1} 预期次数`" /><strong class="test-outcome" :class="{ failed: !busy && !result.error && !testResults.get(test.id)?.passed }">{{ busy ? '运行中' : result.error ? '未运行' : testResults.get(test.id)?.passed ? '通过' : '失败' }}</strong><a-button size="small" type="text" :aria-label="`删除测试 ${index + 1}`" @click="doc.tests.splice(index, 1)"><DeleteOutlined /></a-button></div>
              <a-textarea v-model:value="test.text" :aria-label="`测试 ${index + 1} 文本`" :rows="2" spellcheck="false" placeholder="输入测试文本，空字符串也可以作为测试" />
              <p v-if="testResults.get(test.id)?.error" class="test-failure">{{ testResults.get(test.id)?.error }}</p><p v-else-if="!busy && !result.error && !testResults.get(test.id)?.passed" class="test-failure">实际 {{ testResults.get(test.id)?.count || 0 }}{{ testResults.get(test.id)?.truncated ? '+' : '' }} 处匹配，不符合“{{ testModes.find((mode) => mode.value === test.mode)?.label }}”预期。</p>
            </div>
          </div>
        </section>
        <section class="results-section" aria-label="正则结果工具">
          <div class="section-heading tools-heading"><div class="tab-row" role="tablist" aria-label="结果工具"><button v-for="tab in toolTabs" :key="tab.value" role="tab" :aria-selected="toolsOpen && toolTab === tab.value" :class="{ selected: toolsOpen && toolTab === tab.value }" @click="toolTab = tab.value; toolsOpen = true">{{ tab.label }}</button></div><span class="spacer" /><a-button size="small" type="text" :aria-expanded="toolsOpen" @click="toolsOpen = !toolsOpen">{{ toolsOpen ? '收起' : '展开' }}</a-button></div>
          <div v-show="toolsOpen" class="tools-content">
            <template v-if="toolTab === 'details'">
              <div v-if="!result.matches.length" class="empty-state">{{ busy ? '正在计算匹配结果…' : result.error ? '修正表达式后查看匹配详情。' : '没有匹配结果，试着修改表达式或测试文本。' }}</div>
              <template v-else>
                <div class="match-navigation"><strong>匹配 {{ activeMatch + 1 }} / {{ result.matches.length }}{{ result.truncated ? '+' : '' }}</strong><span class="spacer" /><a-button size="small" aria-label="上一个正则匹配" @click="navigateMatch(-1)"><LeftOutlined /></a-button><a-button size="small" aria-label="下一个正则匹配" @click="navigateMatch(1)"><RightOutlined /></a-button><a-button size="small" @click="copy(currentMatch?.value ?? '', '当前匹配')"><CopyOutlined /> 复制</a-button></div>
                <div class="match-details" v-if="currentMatch"><dl><dt>完整匹配</dt><dd><code>{{ currentMatch.value || '（零宽匹配）' }}</code><small>位置 {{ currentMatch.from }}–{{ currentMatch.to }} · 长度 {{ currentMatch.to - currentMatch.from }}</small></dd></dl><dl v-for="(group, index) in currentMatch.groups" :key="index"><dt><button :disabled="!currentMatch.groupRanges?.[index]" @click="textFocus = { from: currentMatch.groupRanges![index]![0], to: currentMatch.groupRanges![index]![1] }; textEditor?.selectRange(textFocus.from, textFocus.to, false)">分组 {{ index + 1 }}</button></dt><dd><code>{{ group === null ? '（未参与匹配）' : group === '' ? '（空字符串）' : group }}</code><small v-if="currentMatch.groupRanges?.[index]">位置 {{ currentMatch.groupRanges[index]![0] }}–{{ currentMatch.groupRanges[index]![1] }}</small></dd></dl><dl v-for="(group, name) in currentMatch.namedGroups" :key="name"><dt>{{ name }}</dt><dd><code>{{ group === null ? '（未参与匹配）' : group === '' ? '（空字符串）' : group }}</code></dd></dl></div>
                <details class="all-matches"><summary>所有匹配（{{ result.matches.length }}{{ result.truncated ? '+' : '' }}）</summary><button v-for="(match, index) in result.matches.slice(0, visibleMatches)" :key="index" :class="{ selected: activeMatch === index }" @click="chooseMatch(index)"><span>#{{ index + 1 }} · {{ match.from }}–{{ match.to }}</span><code>{{ match.value || '（零宽匹配）' }}</code></button><a-button v-if="visibleMatches < result.matches.length" size="small" @click="visibleMatches += 50">再显示 50 项</a-button></details>
                <p v-if="doc.engine === 'pcre'" class="inline-note">PCRE 显示完整匹配位置与分组内容；当前引擎接口不提供捕获分组的位置。</p>
              </template>
              <p v-if="result.truncated" class="inline-note">{{ result.outputError }}</p>
            </template>
            <template v-else-if="toolTab === 'replace' || toolTab === 'list'">
              <div class="output-form"><label :for="`regex-${toolTab}-template`">{{ toolTab === 'replace' ? '替换模板' : '每个匹配的输出模板' }}</label><a-input v-if="toolTab === 'replace'" id="regex-replace-template" v-model:value="doc.replacement" class="mono" aria-label="替换模板" placeholder="替换内容，可留空以删除匹配" /><a-input v-else id="regex-list-template" v-model:value="doc.listTemplate" class="mono" aria-label="提取模板" placeholder="$&\n" /><p>$& 完整匹配 · $1 分组 · $&lt;name&gt; 命名分组 · \n 换行 · \t 制表符<span v-if="doc.engine === 'pcre'"> · 兼容 $0、${name}、\1</span></p></div>
              <div class="output-actions"><span>输出预览</span><span class="spacer" /><a-button size="small" :disabled="outputDisabled" @click="copy(output, '输出')"><CopyOutlined /> 复制输出</a-button><a-button size="small" :disabled="outputDisabled" @click="download(output, toolTab === 'replace' ? 'regex-replaced.txt' : 'regex-matches.txt')"><DownloadOutlined /> 下载</a-button><a-button v-if="toolTab === 'replace'" size="small" :disabled="outputDisabled || doc.text === output" @click="doc.text = output; announce('替换结果已应用到测试文本，可撤销')">应用到文本</a-button></div>
              <div v-if="outputDisabled" class="empty-state">{{ busy ? '正在生成输出…' : result.outputError || result.error }}</div><RegexCodeEditor v-else :model-value="output" label="正则输出预览" kind="output" />
            </template>
            <template v-else-if="toolTab === 'explain'">
              <p class="inline-note">点击语法片段定位表达式；点击“参考”查看示例。{{ explanation.note }}</p><div v-if="!explanation.tokens.length" class="empty-state">{{ doc.pattern ? '暂时无法解释此表达式。' : '空表达式匹配字符之间的位置，包括文本开头与结尾。' }}</div>
              <div class="explanation-list"><div v-for="(token, index) in explanation.tokens.slice(0, 1000)" :key="index" class="explanation-item"><button :style="{ paddingLeft: `${10 + Math.min(token.depth, 8) * 10}px` }" @click="inspectToken(token)"><code>{{ doc.pattern.slice(token.from, token.to) }}</code><span><strong>{{ token.label }}</strong><small>{{ token.description }}</small></span></button><button class="reference-link" @click="openTokenReference(token)">参考</button></div></div><p v-if="explanation.tokens.length > 1000" class="inline-note">仅展示前 1,000 个语法片段。</p>
            </template>
            <template v-else-if="toolTab === 'code'"><div class="output-actions"><strong>{{ doc.engine === 'javascript' ? 'JavaScript' : 'PHP' }}</strong><span class="spacer" /><a-button size="small" @click="copy(generatedCode, '代码')"><CopyOutlined /> 复制代码</a-button><a-button size="small" @click="download(generatedCode, doc.engine === 'javascript' ? 'regex.js' : 'regex.php')"><DownloadOutlined /> 下载</a-button></div><pre class="generated-code">{{ generatedCode }}</pre><p class="inline-note">代码使用语言的原生正则 API。修改后请在实际运行环境验证版本和修饰符支持。</p></template>
          </div>
        </section>
        <div class="execution-bar"><span>本地执行 · JavaScript / PCRE2 10.47</span><span class="spacer" /><a-button v-if="busy" size="small" @click="stop">停止</a-button><a-button v-else size="small" type="text" @click="run(doc, true)">重新运行</a-button></div>
      </div>
      <aside v-if="sidebarOpen" class="regex-sidebar" aria-label="正则参考与模式库">
        <div class="tab-row sidebar-tabs" role="tablist" aria-label="参考面板"><button v-for="tab in sideTabs" :key="tab.value" role="tab" :aria-selected="sideTab === tab.value" :class="{ selected: sideTab === tab.value }" @click="sideTab = tab.value">{{ tab.label }}</button></div>
        <div v-if="sideTab !== 'help'" class="sidebar-search"><a-input v-model:value="search" :aria-label="sideTab === 'patterns' ? '搜索模式库' : '搜索语法参考'" :placeholder="sideTab === 'patterns' ? '名称、表达式、标签…' : '语法、名称、说明…'" allow-clear><template #prefix><SearchOutlined /></template></a-input></div>
        <template v-if="sideTab === 'cheatsheet' || sideTab === 'reference'">
          <div v-if="selectedReference" class="reference-detail"><button class="back-link" @click="selectedReference = null">← 返回列表</button><h3>{{ selectedReference.title }}</h3><code>{{ selectedReference.syntax }}</code><p>{{ selectedReference.description }}</p><pre>{{ selectedReference.example }}</pre><a-button size="small" @click="insertReference">插入{{ selectedReference.category === '替换与提取' ? '模板' : '表达式' }}</a-button></div>
          <div v-else class="reference-list"><div v-for="category in categories" :key="category" class="reference-category"><h3>{{ category }}</h3><button v-for="item in references.filter((ref) => ref.category === category)" :key="item.id" @click="showReference(item)"><code>{{ item.syntax }}</code><span>{{ item.title }}</span></button></div><div v-if="!references.length" class="empty-state">没有找到相关语法</div></div>
          <button v-if="sideTab === 'cheatsheet'" class="all-reference" @click="sideTab = 'reference'">查看完整语法参考 →</button>
        </template>
        <template v-else-if="sideTab === 'patterns'">
          <div class="library-controls"><select v-model="libraryFilter" aria-label="模式库筛选" class="native-select"><option value="all">全部模式</option><option value="saved">我的模式</option><option value="examples">内置示例</option><option value="favorites">收藏</option></select><a-button size="small" type="text" @click="fileInput?.click()">导入</a-button></div>
          <p class="library-note">{{ patterns.length }} 个模式 · 保存与收藏仅保存在此浏览器</p>
          <div class="pattern-list"><article v-for="item in patterns" :key="item.id" class="pattern-item"><div><button class="pattern-title" @click="loadPattern(item.document, item.local ? item.id : null)">{{ item.document.name || '未命名表达式' }}</button><a-button size="small" type="text" :aria-label="`${favorites.includes(item.id) ? '取消收藏' : '收藏'} ${item.document.name}`" :aria-pressed="favorites.includes(item.id)" @click="library.toggleFavorite(item.id)"><StarFilled v-if="favorites.includes(item.id)" /><StarOutlined v-else /></a-button></div><code>{{ item.document.pattern || '（空表达式）' }}</code><p>{{ item.document.description }}</p><small>{{ item.document.engine === 'pcre' ? 'PCRE2' : 'JavaScript' }} · {{ item.local ? '我的模式' : '内置示例' }}<template v-if="item.document.author"> · {{ item.document.author }}</template></small><div class="pattern-actions"><a-button size="small" @click="loadPattern(item.document, item.local ? item.id : null)">载入</a-button><a-popconfirm v-if="item.local" title="删除此本地模式？当前编辑内容会保留。" ok-text="删除" cancel-text="取消" @confirm="library.remove(item.id)"><a-button size="small" type="text" :aria-label="`删除模式 ${item.document.name}`"><DeleteOutlined /></a-button></a-popconfirm></div></article><div v-if="!patterns.length" class="empty-state">没有符合条件的模式</div></div>
        </template>
        <div v-else class="help-content"><h3>编辑与匹配</h3><p>直接输入表达式，无需两侧的 /。也可以用“导入 /…/”载入带修饰符的表达式。</p><p>g 查找所有非重叠匹配；关闭 g 只查找第一个。空表达式和环视可以产生零宽匹配，文本中用细竖线标记。</p><h3>查看结果</h3><p>悬停在表达式或匹配上查看说明。点击匹配切换分组详情，JavaScript 分组可定位原文。位置从 0 开始，以 UTF-16 单元计数，末尾位置不包含在内。</p><h3>替换与提取</h3><p>替换保留未匹配文本，提取只输出每个匹配的模板。支持 $&、$1、$&lt;name&gt;、$$、$`、$' 和 \n、\r、\t；\\ 输出反斜线。PCRE 还兼容 $0、${name} 和 \1。这是工具的输出模板，不完全等同于 PHP 的 preg_replace 语法。</p><h3>测试集</h3><p>完整匹配要求返回的第一个匹配覆盖全文；包含匹配至少找到一处；不应匹配不能有任何匹配。匹配次数遵循当前 g 选项，每项独立从文本起点运行。</p><h3>PCRE2 引擎</h3><p>通过本地 WebAssembly 执行，支持原子分组、递归、条件、占有量词和 \K。切换到 PCRE 自动启用 u，中文或表情文本需要保留 u。原始 NUL 测试文本暂不支持；分组位置暂不可用。</p><h3>保存与分享</h3><p>草稿自动保存在本机；“保存”将其加入我的模式。“另存为”创建独立副本。导出 JSON 可以备份并在其他浏览器导入。分享链接直接包含所选文本与测试，没有在线账号或公共社区。</p><h3>快捷键</h3><dl><dt>Ctrl / ⌘ + Z</dt><dd>撤销编辑</dd><dt>Ctrl / ⌘ + Shift + Z</dt><dd>重做编辑</dd><dt>Ctrl / ⌘ + S</dt><dd>保存模式</dd><dt>Ctrl / ⌘ + Shift + S</dt><dd>另存为副本</dd><dt>Ctrl / ⌘ + F</dt><dd>在文本编辑器中查找</dd></dl><h3>执行限制</h3><p>单次运行上限 3 秒，最多显示 5,000 处匹配。文本上限 100 万字符，表达式 2 万字符，测试集 200 项。达到匹配上限后不会提供不完整的替换输出。</p><a href="https://regexr.com/" target="_blank" rel="noopener noreferrer">功能参考：RegExr ↗</a></div>
      </aside>
    </div>
    <p class="workbench-notice">表达式、文本与测试集只在浏览器本地运行并保存。分享链接包含你勾选的内容；首次加载后可离线使用。</p>
  </ToolCard>
  <a-modal v-model:open="settingsOpen" title="模式信息" :footer="null"><div class="modal-fields"><label>名称<a-input v-model:value="doc.name" :maxlength="200" /></label><label>说明<a-textarea v-model:value="doc.description" :rows="4" :maxlength="10000" /></label><label>作者<a-input v-model:value="doc.author" :maxlength="200" /></label><label>标签<a-input v-model:value="doc.tags" placeholder="用逗号分隔，便于搜索" :maxlength="1000" /></label><a-button type="primary" @click="save(); settingsOpen = false">保存模式信息</a-button></div></a-modal>
  <a-modal v-model:open="shareOpen" title="分享表达式" :footer="null"><div class="modal-fields"><p>链接包含表达式、修饰符、输出模板与模式信息，可选择是否包含文本和测试集。任何拿到链接的人都可以查看这些内容。</p><a-checkbox v-model:checked="shareText">包含测试文本</a-checkbox><a-checkbox v-model:checked="shareTests">包含测试集（{{ doc.tests.length }} 项）</a-checkbox><a-button type="primary" @click="createShare">生成分享链接</a-button><template v-if="shareUrl"><a-textarea :value="shareUrl" readonly :rows="3" aria-label="分享链接" /><a-button @click="copy(shareUrl, '分享链接')"><CopyOutlined /> 复制分享链接</a-button></template><p v-if="actionError" class="test-failure" role="alert">{{ actionError }}</p><small>内容过长时请使用“导出当前模式”分享 JSON 文件。</small></div></a-modal>
  <a-modal v-model:open="literalOpen" title="导入带分隔符的表达式" ok-text="导入" cancel-text="取消" @ok="importLiteral"><a-textarea v-model:value="literalInput" :rows="3" aria-label="带分隔符的表达式" placeholder="/\d+/gi" spellcheck="false" /><p class="inline-note">将表达式与修饰符分别填入编辑器，使用当前选择的引擎。</p><p v-if="literalError" class="test-failure" role="alert">{{ literalError }}</p></a-modal>
</template>

<style scoped>
.regex-workbench { padding: 0 !important; overflow: hidden; }
.document-toolbar, .section-heading, .text-toolbar, .match-navigation, .output-actions, .execution-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 10px 14px; }
.document-toolbar { border-bottom: 1px solid var(--line); padding: 13px 14px; }
.document-name { width: 200px; font-weight: 600; }
.save-state, .elapsed, .flags-help { font-size: 11px; color: var(--text-muted); }
.spacer { flex: 1 1 auto; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
.regex-layout { display: grid; grid-template-columns: minmax(0, 1fr) 258px; }
.regex-layout.sidebar-hidden { grid-template-columns: minmax(0, 1fr); }
.regex-main, .regex-sidebar { min-width: 0; }
.regex-sidebar { border-left: 1px solid var(--line); background: var(--panel-subtle); }
.section-heading { min-height: 47px; background: var(--panel-subtle); border-bottom: 1px solid var(--line); }
.section-heading strong { font-size: 12px; }
.native-select { max-width: 100%; min-width: 0; padding: 4px 8px; border: 1px solid var(--line); border-radius: 5px; color: var(--text-main); background: var(--panel-bg); font-size: 12px; }
.expression-editor-row { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; padding: 0 10px; min-height: 76px; }
.delimiter { align-self: start; padding-top: 18px; color: var(--text-muted); font: 23px/1.7 'SFMono-Regular', Consolas, monospace; text-align: center; }
.delimiter.closing { padding-right: 6px; white-space: nowrap; }
.delimiter small { font-size: 13px; color: var(--accent-text); }
.flags-row { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; padding: 8px 14px 12px; border-bottom: 1px solid var(--line); }
.flags-row > span:first-child { margin-right: 5px; font-size: 11px; color: var(--text-muted); }
.flag-button { min-width: 27px; height: 27px; padding: 0 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel-bg); color: var(--text-muted); font-family: monospace; font-size: 13px; cursor: pointer; }
.flag-button.selected { border-color: var(--accent-text); background: color-mix(in srgb, var(--primary-color) 10%, var(--panel-bg)); color: var(--accent-text); font-weight: 700; }
.flags-help { margin-left: auto; }
.regex-error, .action-error { padding: 12px 14px; color: var(--error-text); font-size: 12px; overflow-wrap: anywhere; }
.regex-error { border-bottom: 1px solid var(--line); }
.regex-error strong { display: block; font-weight: 500; }
.regex-error button, .back-link, .reference-link { padding: 0; border: 0; background: none; color: var(--accent-text); font-size: 12px; cursor: pointer; }
.action-error { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; border-bottom: 1px solid var(--line); }
.feedback { padding: 7px 14px; background: var(--panel-subtle); color: var(--accent-text); font-size: 12px; border-bottom: 1px solid var(--line); }
.tab-row { display: flex; align-items: stretch; flex-wrap: wrap; gap: 3px; }
.tab-row button { position: relative; padding: 8px 9px; border: 0; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; }
.tab-row button.selected { color: var(--accent-text); box-shadow: inset 0 -2px var(--accent-text); font-weight: 600; }
.tab-row small { margin-left: 5px; font-size: 10px; }
.test-heading, .tools-heading { padding-block: 3px; }
.match-status { color: var(--accent-text); font-size: 12px; font-variant-numeric: tabular-nums; }
.text-toolbar { padding-block: 5px; border-bottom: 1px solid var(--line); }
.editor-status { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px; padding: 6px 14px; color: var(--text-muted); font-size: 10px; border-top: 1px solid var(--line); }
.results-section { border-top: 1px solid var(--line); }
.tools-content { min-height: 190px; }
.empty-state { display: grid; min-height: 140px; place-content: center; padding: 25px 18px; color: var(--text-muted); font-size: 12px; text-align: center; overflow-wrap: anywhere; }
.tests-panel { padding: 14px; min-height: 325px; max-height: 600px; overflow: auto; }
.test-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.test-actions > span { font-size: 11px; color: var(--text-muted); }
.test-case { padding-block: 12px; border-top: 1px solid var(--line); }
.test-case-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-bottom: 8px; }
.test-case-heading > .ant-input { flex: 1 1 120px; width: 120px; }
.test-case-heading > .ant-input-number { width: 70px; }
.test-number { color: var(--text-muted); font-size: 11px; }
.test-case :deep(textarea) { font: 12px/1.7 'SFMono-Regular', Consolas, monospace; }
.test-outcome { font-size: 11px; color: var(--accent-text); }
.test-outcome.failed, .test-failure { color: var(--error-text); }
.test-failure { margin: 6px 0 0; font-size: 12px; overflow-wrap: anywhere; }
.match-navigation { padding-block: 9px; font-size: 12px; }
.match-details { padding: 0 14px 14px; max-height: 380px; overflow: auto; }
.match-details dl { display: grid; grid-template-columns: minmax(65px, 105px) minmax(0, 1fr); margin: 0; border-top: 1px solid var(--line); font-size: 12px; }
.match-details dt { padding: 10px 8px 10px 0; color: var(--text-muted); overflow-wrap: anywhere; }
.match-details dt button { padding: 0; border: 0; background: none; color: var(--accent-text); cursor: pointer; }
.match-details dt button:disabled { color: var(--text-muted); cursor: default; }
.match-details dd { margin: 0; padding: 10px 0; min-width: 0; }
.match-details code { white-space: pre-wrap; overflow-wrap: anywhere; }
.match-details small { display: block; margin-top: 4px; color: var(--text-muted); font-size: 10px; }
.all-matches { margin: 0 14px 14px; font-size: 12px; }
.all-matches summary { cursor: pointer; color: var(--text-muted); }
.all-matches > button:not(.ant-btn) { display: grid; grid-template-columns: 105px minmax(0, 1fr); gap: 10px; width: 100%; padding: 7px; text-align: left; border: 0; border-top: 1px solid var(--line); background: var(--panel-bg); color: var(--text-main); cursor: pointer; }
.all-matches > button.selected { background: var(--panel-subtle); }
.all-matches span { font-size: 10px; color: var(--text-muted); }
.all-matches code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.output-form { padding: 14px 14px 8px; }
.output-form label { display: block; margin-bottom: 7px; color: var(--text-main); font-size: 12px; }
.output-form p, .inline-note { margin: 8px 14px 12px; color: var(--text-muted); font-size: 11px; overflow-wrap: anywhere; }
.output-form p { margin-inline: 0; margin-bottom: 0; }
.output-actions { padding-block: 7px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--text-muted); }
.explanation-list { max-height: 430px; overflow: auto; padding-bottom: 10px; }
.explanation-item { display: flex; align-items: center; border-top: 1px solid var(--line); }
.explanation-item > button:first-child { display: grid; grid-template-columns: minmax(55px, 120px) minmax(0, 1fr); gap: 12px; flex: 1; min-width: 0; padding: 10px; border: 0; background: var(--panel-bg); color: var(--text-main); text-align: left; cursor: pointer; }
.explanation-item > button:first-child:hover { background: var(--panel-subtle); }
.explanation-item code { color: var(--accent-text); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.explanation-item strong { display: block; font-size: 12px; font-weight: 500; }
.explanation-item small { display: block; margin-top: 3px; color: var(--text-muted); font-size: 11px; }
.reference-link { margin-right: 12px; flex-shrink: 0; }
.generated-code { margin: 0; padding: 14px; max-height: 420px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.8; }
.execution-bar { border-top: 1px solid var(--line); color: var(--text-muted); font-size: 10px; }
.sidebar-tabs { min-height: 48px; justify-content: center; gap: 3px; border-bottom: 1px solid var(--line); }
.sidebar-tabs button { padding-inline: 12px; }
.sidebar-search { padding: 12px; }
.reference-list, .pattern-list { max-height: 770px; overflow-y: auto; }
.reference-category { padding: 0 12px 12px; }
.reference-category h3 { margin: 12px 0 6px; font-size: 11px; color: var(--text-muted); font-weight: 600; }
.reference-category > button { display: grid; grid-template-columns: minmax(60px, 45%) minmax(0, 1fr); gap: 10px; width: 100%; padding: 6px 4px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--text-main); text-align: left; cursor: pointer; }
.reference-category > button:hover { background: var(--panel-bg); }
.reference-category code { font-size: 11px; color: var(--accent-text); overflow-wrap: anywhere; }
.reference-category span { font-size: 11px; overflow-wrap: anywhere; }
.all-reference { display: block; width: 100%; padding: 15px; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--accent-text); font-size: 12px; cursor: pointer; }
.reference-detail { padding: 10px 16px 20px; }
.reference-detail h3 { margin: 14px 0 8px; font-size: 16px; }
.reference-detail > code { display: block; color: var(--accent-text); overflow-wrap: anywhere; }
.reference-detail p { margin: 12px 0; font-size: 12px; }
.reference-detail pre { margin-block: 12px; padding: 10px; background: var(--panel-bg); border: 1px solid var(--line); font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
.library-controls { display: flex; gap: 7px; padding: 0 12px; }
.library-controls select { flex: 1; }
.library-note { padding: 0 12px; margin: 8px 0 12px; color: var(--text-muted); font-size: 10px; }
.pattern-item { padding: 14px 12px; border-top: 1px solid var(--line); }
.pattern-item > div:first-child { display: flex; align-items: start; gap: 5px; }
.pattern-title { min-width: 0; overflow-wrap: anywhere; flex: 1; padding: 0; border: 0; background: none; color: var(--text-main); font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
.pattern-item > code { display: block; margin-top: 6px; color: var(--accent-text); font-size: 11px; max-height: 65px; overflow: hidden; overflow-wrap: anywhere; }
.pattern-item p { overflow-wrap: anywhere; margin: 6px 0; color: var(--text-muted); font-size: 11px; }
.pattern-item small { overflow-wrap: anywhere; color: var(--text-muted); font-size: 10px; }
.pattern-actions { display: flex; justify-content: space-between; margin-top: 10px; }
.help-content { padding: 8px 16px 20px; max-height: 950px; overflow-y: auto; font-size: 12px; }
.help-content h3 { margin: 15px 0 7px; font-size: 13px; }
.help-content p { margin: 0 0 9px; color: var(--text-muted); }
.help-content dl { font-size: 11px; }
.help-content dd { margin-left: 0; margin-bottom: 7px; color: var(--text-muted); }
.help-content a { color: var(--accent-text); }
.workbench-notice { margin: 0; padding: 12px 16px; border-top: 1px solid var(--line); color: var(--text-muted); font-size: 11px; }
.modal-fields { display: flex; flex-direction: column; gap: 14px; font-size: 13px; }
.modal-fields > label > .ant-input { margin-top: 6px; }
.modal-fields p { margin: 0; }
.modal-fields small { color: var(--text-muted); }
@container (max-width: 920px) { .regex-layout { grid-template-columns: minmax(0, 1fr) 230px; } .sidebar-tabs button { padding-inline: 9px; } .expression-heading { gap: 3px; } }
@container (max-width: 720px) { .regex-layout { grid-template-columns: minmax(0, 1fr); } .regex-sidebar { border-left: 0; border-top: 1px solid var(--line); } .reference-list { max-height: 420px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } .reference-detail { max-width: 600px; } .sidebar-tabs { justify-content: flex-start; padding-left: 10px; } .help-content { max-height: 550px; } .pattern-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 550px; } }
@container (max-width: 440px) { .document-name { width: calc(100% - 52px); } .document-toolbar > .spacer { display: none; } .document-toolbar > .ant-btn { flex: 1 0 auto; } .section-heading { padding-inline: 9px; } .expression-heading > .spacer { flex-basis: 100%; } .expression-heading > strong { margin-right: 6px; } .flags-help { display: none; } .test-heading { gap: 5px; } .test-heading > .spacer { display: none; } .test-heading .tab-row { flex: 1 1 100%; } .tab-row button { padding-inline: 7px; } .tools-heading > .spacer { display: none; } .tools-heading > .ant-btn { margin-left: auto; } .reference-list, .pattern-list { grid-template-columns: minmax(0, 1fr); } .test-case-heading > .ant-input { flex-basis: calc(100% - 30px); } .explanation-item > button:first-child { grid-template-columns: minmax(0, 1fr); gap: 5px; } .expression-editor-row { grid-template-columns: 16px minmax(0, 1fr) auto; padding-inline: 4px; } .match-details dl { grid-template-columns: 75px minmax(0, 1fr); } }
</style>
