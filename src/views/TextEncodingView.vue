<script setup lang="ts">
import { computed, ref } from 'vue'
import { CodeOutlined, CopyOutlined, RetweetOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { decodeText, encodeText, encodingOptions, type EncodingType } from '../utils/encoding'

const mode = ref<'encode' | 'decode'>('encode')
const type = ref<EncodingType>('base64')
const input = ref('你好，LittleTools!')
const output = ref('')
const error = ref('')
const copied = ref(false)

rememberToolSettings('text-encoding', { mode, type, input })
const inputStats = computed(() => `${Array.from(input.value).length} 字符 · ${new TextEncoder().encode(input.value).length} 字节`)

function convert() {
  error.value = ''
  try { output.value = mode.value === 'encode' ? encodeText(input.value, type.value) : decodeText(input.value, type.value) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '转换失败'; output.value = '' }
}

function swap() {
  if (output.value) input.value = output.value
  output.value = ''
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
}

async function copy() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1500)
}

convert()
</script>

<template>
  <ToolPageHeader title="文本编码转换" description="在常见的文本与字节编码之间进行本地转换" :icon="CodeOutlined" color="#496a94" />
  <ToolCard title="转换设置">
    <div class="encoding-toolbar">
      <a-segmented v-model:value="mode" :options="[{ label: '编码', value: 'encode' }, { label: '解码', value: 'decode' }]" />
      <a-select v-model:value="type" :options="encodingOptions" style="min-width: 180px" />
      <a-button @click="swap"><RetweetOutlined /> 交换方向</a-button>
    </div>
    <div class="encoding-panes">
      <div class="text-pane">
        <div class="pane-head"><span>输入文本</span><small>{{ inputStats }}</small></div>
        <a-textarea v-model:value="input" :rows="12" placeholder="在此输入待转换内容" />
      </div>
      <div class="text-pane output-pane">
        <div class="pane-head"><span>转换结果</span><a-button type="text" size="small" :disabled="!output" @click="copy"><CopyOutlined /> {{ copied ? '已复制' : '复制' }}</a-button></div>
        <a-textarea :value="output" :rows="12" readonly placeholder="结果会显示在这里" />
      </div>
    </div>
    <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top: 16px" />
    <div class="form-actions"><a-button type="primary" size="large" @click="convert">{{ mode === 'encode' ? '开始编码' : '开始解码' }}</a-button><a-button size="large" @click="input = ''; output = ''; error = ''">清空</a-button></div>
    <div class="notice">Base64、Hex 和二进制均按 UTF-8 字节处理；Unicode 使用 <span class="mono">\u{...}</span> 码点格式，可正确处理 emoji 等非 BMP 字符。</div>
  </ToolCard>
</template>

<style scoped>
.encoding-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
.encoding-panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.text-pane { min-width: 0; }
.pane-head { display: flex; align-items: center; justify-content: space-between; height: 36px; color: var(--text-main); font-size: 12px; font-weight: 600; }
.pane-head small { color: var(--text-muted); font-weight: 400; }
.text-pane :deep(textarea) { resize: vertical; font-family: "SFMono-Regular", Consolas, monospace; line-height: 1.6; }
.output-pane :deep(textarea) { background: var(--panel-subtle); }
@media (max-width: 760px) { .encoding-panes { grid-template-columns: 1fr; } .encoding-toolbar > * { flex: 1 1 auto; } }
</style>
