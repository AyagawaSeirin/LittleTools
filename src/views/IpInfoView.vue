<script setup lang="ts">
import { computed, ref } from 'vue'
import { EnvironmentOutlined, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { parseIPv4, parseIPv6 } from '../utils/ip'

interface IpResponse {
  success: boolean
  message?: string
  ip: string
  type: string
  continent: string
  country: string
  country_code: string
  region: string
  city: string
  latitude: number
  longitude: number
  postal: string
  flag: { emoji: string }
  connection: { asn: number; org: string; isp: string; domain: string }
  timezone: { id: string; abbr: string; utc: string; is_dst: boolean }
  source?: string
}

interface MonIpResponse {
  ip: string
  version: number
  hostname: string
  country: string
  country_code: string
  flag: string
  region: string
  city: string
  timezone: string
  latitude: number
  longitude: number
  asn: string
  asn_org: string
  isp: string
}

const query = ref('')
const loading = ref(false)
const error = ref('')
const data = ref<IpResponse | null>(null)

rememberToolSettings('ip-info', { query })
const mapUrl = computed(() => data.value ? `https://www.openstreetmap.org/?mlat=${data.value.latitude}&mlon=${data.value.longitude}#map=10/${data.value.latitude}/${data.value.longitude}` : '#')

async function lookup() {
  error.value = ''
  data.value = null
  const value = query.value.trim()
  if (value) {
    try { value.includes(':') ? parseIPv6(value) : parseIPv4(value) }
    catch { error.value = '请输入有效的 IPv4 或 IPv6 地址'; return }
  }
  loading.value = true
  try {
    const primaryResponse = await fetch(`https://ipwho.is/${value ? encodeURIComponent(value) : ''}`)
    if (primaryResponse.ok) {
      const result = await primaryResponse.json() as IpResponse
      if (!result.success) throw new Error(result.message || '未找到该 IP 的信息')
      result.source = 'ipwho.is'
      data.value = result
    } else if (value) {
      const fallbackResponse = await fetch(`https://monip.lws.fr/api/${encodeURIComponent(value)}`)
      if (!fallbackResponse.ok) throw new Error(`查询服务返回 ${fallbackResponse.status}`)
      const fallback = await fallbackResponse.json() as MonIpResponse
      data.value = {
        success: true,
        ip: fallback.ip,
        type: `IPv${fallback.version}`,
        continent: '',
        country: fallback.country,
        country_code: fallback.country_code,
        region: fallback.region,
        city: fallback.city,
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        postal: '',
        flag: { emoji: fallback.flag },
        connection: {
          asn: Number((fallback.asn || '').replace(/\D/g, '')) || 0,
          org: fallback.asn_org,
          isp: fallback.isp,
          domain: fallback.hostname,
        },
        timezone: { id: fallback.timezone, abbr: '', utc: '', is_dst: false },
        source: 'monip.lws.fr',
      }
    } else {
      throw new Error(`查询服务返回 ${primaryResponse.status}，请稍后重试或输入指定 IP`)
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '查询失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <ToolPageHeader title="IP 信息查询" description="查询公网 IP 的大致归属位置、网络组织与时区" :icon="InfoCircleOutlined" color="#447052" />
  <ToolCard title="查询 IP" description="留空可查询当前出口 IP；结果来自第三方公共数据服务。">
    <div class="lookup-row"><a-input v-model:value="query" class="mono" size="large" placeholder="IPv4 / IPv6，留空查询当前 IP" allow-clear @press-enter="lookup"><template #prefix><SearchOutlined /></template></a-input><a-button type="primary" size="large" :loading="loading" @click="lookup">开始查询</a-button></div>
    <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top: 16px" />
    <div class="notice">隐私提示：点击查询后，待查询 IP 会发送至 <span class="mono">ipwho.is</span>；服务不可用时，指定 IP 会改由 <span class="mono">monip.lws.fr</span> 查询。本站不存储查询内容。</div>
  </ToolCard>

  <ToolCard v-if="data" title="查询结果">
    <div class="ip-identity"><div class="flag">{{ data.flag.emoji }}</div><div><span>{{ data.type }} · 数据源 {{ data.source }}</span><h2>{{ data.ip }}</h2><p>{{ [data.city, data.region, data.country].filter(Boolean).join(' · ') }}</p></div></div>
    <div class="info-grid">
      <div><span>国家 / 地区</span><strong>{{ data.country }} ({{ data.country_code }})</strong></div>
      <div><span>城市</span><strong>{{ data.city || '—' }}</strong></div>
      <div><span>邮政编码</span><strong>{{ data.postal || '—' }}</strong></div>
      <div><span>网络组织</span><strong>{{ data.connection.org || '—' }}</strong></div>
      <div><span>ISP</span><strong>{{ data.connection.isp || '—' }}</strong></div>
      <div><span>ASN</span><strong>{{ data.connection.asn ? `AS${data.connection.asn}` : '—' }}</strong></div>
      <div><span>时区</span><strong>{{ data.timezone.id }}{{ data.timezone.utc ? ` (UTC${data.timezone.utc})` : '' }}</strong></div>
      <div><span>坐标</span><strong>{{ data.latitude }}, {{ data.longitude }}</strong></div>
    </div>
    <a :href="mapUrl" target="_blank" rel="noopener noreferrer" class="map-link"><EnvironmentOutlined /> 在 OpenStreetMap 中查看大致位置</a>
  </ToolCard>
</template>

<style scoped>
.lookup-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
.ip-identity { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
.flag { font-size: 38px; }
.ip-identity span { color: var(--text-muted); font-size: 11px; }
.ip-identity h2 { margin: 2px 0; font-family: monospace; font-size: 22px; overflow-wrap: anywhere; }
.ip-identity p { margin: 0; color: var(--text-muted); font-size: 13px; }
.info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: var(--line); }
.info-grid > div { min-width: 0; padding: 14px 16px; background: var(--panel-subtle); }
.info-grid span { display: block; margin-bottom: 5px; color: var(--text-muted); font-size: 11px; }
.info-grid strong { display: block; overflow-wrap: anywhere; color: var(--text-main); font-size: 13px; }
.map-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 16px; color: var(--primary-color); font-size: 12px; }
@media (max-width: 640px) { .lookup-row { grid-template-columns: 1fr; } .info-grid { grid-template-columns: 1fr; } }
</style>
