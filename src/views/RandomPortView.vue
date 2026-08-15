<script setup lang="ts">
import { computed, ref } from 'vue'
import { NumberOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { randomInt } from '../utils/random'

const minPort = ref(1024)
const maxPort = ref(65535)
const count = ref(10)
const unique = ref(true)
const results = ref<number[]>([])
const error = ref('')

rememberToolSettings('random-port', { minPort, maxPort, count, unique })
const capacity = computed(() => Math.max(0, maxPort.value - minPort.value + 1))

const knownPorts: Record<number, string> = { 20: 'FTP 数据', 21: 'FTP', 22: 'SSH', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 3306: 'MySQL', 5432: 'PostgreSQL', 6379: 'Redis', 8080: 'HTTP 备用' }

function generate() {
  error.value = ''
  if (minPort.value < 1 || maxPort.value > 65535 || minPort.value > maxPort.value) {
    error.value = '端口范围应在 1–65535 之间，且起始值不能大于结束值'
    return
  }
  if (unique.value && count.value > capacity.value) {
    error.value = `当前范围最多只能生成 ${capacity.value} 个不重复端口`
    return
  }
  const values = new Set<number>()
  const output: number[] = []
  while (output.length < count.value) {
    const value = randomInt(minPort.value, maxPort.value)
    if (!unique.value || !values.has(value)) {
      values.add(value)
      output.push(value)
    }
  }
  results.value = output
}

generate()
</script>

<template>
  <ToolPageHeader title="随机端口生成" description="在 TCP / UDP 合法端口范围 1–65535 内安全随机取值" :icon="NumberOutlined" color="#75602b" />
  <ToolCard title="生成设置" description="默认避开 1–1023 的系统知名端口。">
    <div class="form-grid three">
      <div class="form-field"><span class="field-label">起始端口</span><a-input-number v-model:value="minPort" :min="1" :max="65535" style="width: 100%" /></div>
      <div class="form-field"><span class="field-label">结束端口</span><a-input-number v-model:value="maxPort" :min="1" :max="65535" style="width: 100%" /></div>
      <div class="form-field"><span class="field-label">生成数量</span><a-input-number v-model:value="count" :min="1" :max="1000" style="width: 100%" /></div>
      <div class="form-field full option-row">
        <a-checkbox v-model:checked="unique">结果不重复</a-checkbox>
        <a-button size="small" @click="minPort = 1024; maxPort = 65535">动态 / 私有端口范围</a-button>
        <a-button size="small" @click="minPort = 1; maxPort = 65535">全部合法端口</a-button>
      </div>
    </div>
    <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top: 18px" />
    <div class="form-actions"><a-button type="primary" size="large" @click="generate"><ReloadOutlined /> 生成端口</a-button></div>
    <ResultPanel :value="results.join('\n')" label="生成结果" />
  </ToolCard>
  <ToolCard title="常见端口速查">
    <div class="port-tags"><a-tag v-for="(name, port) in knownPorts" :key="port"><b>{{ port }}</b> {{ name }}</a-tag></div>
  </ToolCard>
</template>

<style scoped>
.port-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.port-tags :deep(.ant-tag) { margin: 0; padding: 5px 9px; border-color: var(--line); background: var(--panel-subtle); }
.port-tags b { margin-right: 3px; font-family: monospace; }
</style>
