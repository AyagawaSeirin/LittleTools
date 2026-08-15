<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalculatorOutlined, DeploymentUnitOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { cidrRange, formatIPv4, formatIPv6, formatIPv6Expanded, ipv4Mask, ipv6Ptr, parseIPv4, parseIPv6 } from '../utils/ip'

interface ResultItem { label: string; value: string; hint?: string }

const version = ref<'4' | '6'>('4')
const address = ref('192.168.1.42')
const prefix = ref(24)
const results = ref<ResultItem[]>([])
const error = ref('')

rememberToolSettings('cidr-calculator', { version, address, prefix })
const prefixOptions = computed(() => Array.from({ length: version.value === '4' ? 33 : 129 }, (_, value) => ({ value, label: `/${value}` })))

function switchVersion(value: '4' | '6') {
  version.value = value
  address.value = value === '4' ? '192.168.1.42' : '2001:db8:1234::42'
  prefix.value = value === '4' ? 24 : 64
  calculate()
}

function calculate() {
  error.value = ''
  try {
    if (version.value === '4') {
      const value = parseIPv4(address.value)
      const range = cidrRange(value, prefix.value, 32)
      const usableStart = prefix.value <= 30 ? range.start + 1n : range.start
      const usableEnd = prefix.value <= 30 ? range.end - 1n : range.end
      const host = formatIPv4(value)
      results.value = [
        { label: '主机地址', value: host, hint: '点分十进制' },
        { label: '十进制表示', value: value.toString(), hint: '无符号 32 位整数' },
        { label: '十六进制表示', value: `0x${value.toString(16).padStart(8, '0').toUpperCase()}` },
        { label: '子网 CIDR', value: `${formatIPv4(range.start)}/${prefix.value}` },
        { label: '网络范围', value: `${formatIPv4(range.start)} – ${formatIPv4(range.end)}`, hint: `${range.total.toLocaleString()} 个地址` },
        { label: '可用范围', value: `${formatIPv4(usableStart)} – ${formatIPv4(usableEnd)}`, hint: prefix.value <= 30 ? `${(range.total - 2n).toLocaleString()} 个传统可用地址` : '点对点 / 主机路由' },
        { label: '广播地址', value: formatIPv4(range.end) },
        { label: '子网掩码', value: ipv4Mask(prefix.value) },
        { label: '反掩码', value: formatIPv4(((1n << 32n) - 1n) ^ range.mask) },
        { label: 'PTR 记录示例', value: `${host.split('.').reverse().join('.')}.in-addr.arpa`, hint: '反向 DNS' },
      ]
    } else {
      const value = parseIPv6(address.value)
      const range = cidrRange(value, prefix.value, 128)
      const subnet64Count = prefix.value <= 64 ? 1n << BigInt(64 - prefix.value) : 0n
      results.value = [
        { label: '压缩地址', value: formatIPv6(value), hint: '冒号十六进制' },
        { label: '展开地址', value: formatIPv6Expanded(value), hint: '完整 8 组表示' },
        { label: '十进制表示', value: value.toString(), hint: '无符号 128 位整数' },
        { label: '子网前缀', value: `${formatIPv6(range.start)}/${prefix.value}` },
        { label: '网络范围', value: `${formatIPv6(range.start)} – ${formatIPv6(range.end)}`, hint: `${range.total.toLocaleString()} 个地址` },
        { label: '/64 子网数量', value: prefix.value <= 64 ? subnet64Count.toLocaleString() : '当前前缀比 /64 更具体' },
        { label: 'PTR 记录示例', value: ipv6Ptr(value), hint: '反向 DNS' },
      ]
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '计算失败'
    results.value = []
  }
}

calculate()
</script>

<template>
  <ToolPageHeader title="IP 范围计算器" description="解析 IPv4 / IPv6 地址的网络前缀、范围、掩码和反向记录" :icon="DeploymentUnitOutlined" color="#6a56a3" />
  <ToolCard title="输入网络地址" description="地址可以是网段中的任意主机，计算结果会自动归一到网络边界。">
    <div class="cidr-input-row">
      <div class="form-field"><span class="field-label">协议版本</span><a-segmented :value="version" :options="[{ label: 'IPv4', value: '4' }, { label: 'IPv6', value: '6' }]" block @change="switchVersion($event as '4' | '6')" /></div>
      <div class="form-field address-field"><span class="field-label">IP 地址</span><a-input v-model:value="address" class="mono" @press-enter="calculate" /></div>
      <div class="form-field"><span class="field-label">CIDR 前缀</span><a-select v-model:value="prefix" :options="prefixOptions" show-search style="width: 100%" /></div>
    </div>
    <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top: 18px" />
    <div class="form-actions"><a-button type="primary" size="large" @click="calculate"><CalculatorOutlined /> 计算范围</a-button></div>
  </ToolCard>

  <ToolCard v-if="results.length" title="计算结果">
    <div class="cidr-results">
      <div v-for="item in results" :key="item.label" class="cidr-result-item">
        <div><span>{{ item.label }}</span><small v-if="item.hint">{{ item.hint }}</small></div>
        <code>{{ item.value }}</code>
      </div>
    </div>
    <div class="notice">IPv4 的“可用范围”沿用传统子网规则，排除网络地址和广播地址；/31 与 /32 按点对点及主机路由显示完整范围。</div>
  </ToolCard>
</template>

<style scoped>
.cidr-input-row { display: grid; grid-template-columns: 180px minmax(240px, 1fr) 150px; gap: 18px; }
.cidr-results { overflow: hidden; border: 1px solid var(--line); border-radius: 10px; }
.cidr-result-item { display: grid; grid-template-columns: 180px minmax(0, 1fr); min-height: 64px; border-bottom: 1px solid var(--line); }
.cidr-result-item:last-child { border-bottom: 0; }
.cidr-result-item > div { display: flex; flex-direction: column; justify-content: center; padding: 12px 15px; background: var(--panel-subtle); }
.cidr-result-item span { color: var(--text-main); font-size: 13px; font-weight: 600; }
.cidr-result-item small { margin-top: 4px; color: var(--text-muted); font-size: 11px; }
.cidr-result-item code { display: flex; align-items: center; min-width: 0; padding: 12px 16px; overflow-wrap: anywhere; color: var(--text-main); font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; }
@media (max-width: 720px) { .cidr-input-row { grid-template-columns: 1fr; } .cidr-result-item { grid-template-columns: 1fr; } .cidr-result-item > div { border-bottom: 1px solid var(--line); } }
</style>
