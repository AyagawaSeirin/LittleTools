<script setup lang="ts">
import { ref } from 'vue'
import { DownloadOutlined, GlobalOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { IPV4_MAX, IPV6_MAX, cidrRange, formatIPv4, formatIPv6, isPublicIPv4, parseIPv4, parseIPv6, randomInRange } from '../utils/ip'

const version = ref<'4' | '6'>('4')
const mode = ref<'any' | 'cidr' | 'range'>('any')
const cidr = ref('192.168.1.0/24')
const startAddress = ref('10.0.0.1')
const endAddress = ref('10.0.0.254')
const count = ref(10)
const unique = ref(true)
const publicOnly = ref(false)
const results = ref<string[]>([])
const error = ref('')

rememberToolSettings('random-ip', {
  version,
  mode,
  cidr,
  startAddress,
  endAddress,
  count,
  unique,
  publicOnly,
})

function setVersion(value: '4' | '6') {
  version.value = value
  cidr.value = value === '4' ? '192.168.1.0/24' : '2001:db8::/64'
  startAddress.value = value === '4' ? '10.0.0.1' : '2001:db8::1'
  endAddress.value = value === '4' ? '10.0.0.254' : '2001:db8::ffff'
  publicOnly.value = false
  results.value = []
}

function resolveRange() {
  const bits = version.value === '4' ? 32 : 128
  const parser = version.value === '4' ? parseIPv4 : parseIPv6
  if (mode.value === 'any') return { start: 0n, end: version.value === '4' ? IPV4_MAX : IPV6_MAX }
  if (mode.value === 'cidr') {
    const [address, prefixRaw] = cidr.value.trim().split('/')
    if (address.includes(':') !== (version.value === '6')) throw new Error(`请输入 IPv${version.value} CIDR`)
    const prefix = Number(prefixRaw)
    return cidrRange(parser(address), prefix, bits)
  }
  return { start: parser(startAddress.value), end: parser(endAddress.value) }
}

function generate() {
  error.value = ''
  try {
    const { start, end } = resolveRange()
    if (start > end) throw new Error('起始地址不能大于结束地址')
    if (unique.value && BigInt(count.value) > end - start + 1n) throw new Error('生成数量超过当前地址范围容量')
    const output: string[] = []
    const seen = new Set<string>()
    let attempts = 0
    while (output.length < count.value && attempts < count.value * 1000) {
      attempts += 1
      const value = randomInRange(start, end)
      if (version.value === '4' && publicOnly.value && !isPublicIPv4(value)) continue
      const formatted = version.value === '4' ? formatIPv4(value) : formatIPv6(value)
      if (unique.value && seen.has(formatted)) continue
      seen.add(formatted)
      output.push(formatted)
    }
    if (output.length < count.value) throw new Error('当前条件下没有足够的可用地址，请放宽范围')
    results.value = output
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '生成失败'
  }
}

function download() {
  const blob = new Blob([results.value.join('\n')], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `random-ipv${version.value}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <ToolPageHeader title="随机 IP 地址" description="按地址类型、CIDR 网段或起止范围批量生成" :icon="GlobalOutlined" color="#2d7763" />
  <ToolCard title="生成条件">
    <div class="form-grid">
      <div class="form-field"><span class="field-label">地址类型</span><a-segmented :value="version" :options="[{ label: 'IPv4', value: '4' }, { label: 'IPv6', value: '6' }]" block @change="setVersion($event as '4' | '6')" /></div>
      <div class="form-field"><span class="field-label">地址范围</span><a-segmented v-model:value="mode" :options="[{ label: '全部', value: 'any' }, { label: 'CIDR', value: 'cidr' }, { label: '起止地址', value: 'range' }]" block /></div>
      <div v-if="mode === 'cidr'" class="form-field full"><span class="field-label">CIDR 网段</span><a-input v-model:value="cidr" class="mono" :placeholder="version === '4' ? '192.168.1.0/24' : '2001:db8::/64'" /></div>
      <template v-if="mode === 'range'">
        <div class="form-field"><span class="field-label">起始地址</span><a-input v-model:value="startAddress" class="mono" /></div>
        <div class="form-field"><span class="field-label">结束地址</span><a-input v-model:value="endAddress" class="mono" /></div>
      </template>
      <div class="form-field"><span class="field-label">生成数量</span><a-input-number v-model:value="count" :min="1" :max="1000" style="width: 100%" /></div>
      <div class="form-field"><span class="field-label">规则</span><div class="option-row"><a-checkbox v-model:checked="unique">结果唯一</a-checkbox><a-checkbox v-if="version === '4'" v-model:checked="publicOnly">排除私有 / 保留地址</a-checkbox></div></div>
    </div>
    <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top: 18px" />
    <div class="form-actions"><a-button type="primary" size="large" @click="generate"><ReloadOutlined /> 生成地址</a-button><a-button size="large" :disabled="!results.length" @click="download"><DownloadOutlined /> 下载 .txt</a-button></div>
    <ResultPanel :value="results.join('\n')" :label="results.length ? `生成结果 · ${results.length} 个` : '生成结果'" />
  </ToolCard>
</template>
