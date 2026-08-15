<script setup lang="ts">
import { computed, ref } from 'vue'
import { RadarChartOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import {
  buildNmapCommand,
  type NmapDnsMode,
  type NmapOutputMode,
  type NmapPortMode,
  type NmapScanType,
  type NmapScriptPreset,
} from '../utils/nmap'

const target = ref('scanme.nmap.org')
const useSudo = ref(false)
const scanType = ref<NmapScanType>('syn')
const portMode = ref<NmapPortMode>('default')
const customPorts = ref('22,80,443')
const topPorts = ref(100)
const serviceVersion = ref(false)
const osDetection = ref(false)
const scriptPreset = ref<NmapScriptPreset>('none')
const noPing = ref(false)
const onlyOpen = ref(false)
const traceroute = ref(false)
const showReason = ref(false)
const ipv6 = ref(false)
const verbose = ref(false)
const timing = ref(3)
const dnsMode = ref<NmapDnsMode>('default')
const outputMode = ref<NmapOutputMode>('none')
const outputName = ref('nmap-scan')

rememberToolSettings('nmap-generator', {
  target,
  useSudo,
  scanType,
  portMode,
  customPorts,
  topPorts,
  serviceVersion,
  osDetection,
  scriptPreset,
  noPing,
  onlyOpen,
  traceroute,
  showReason,
  ipv6,
  verbose,
  timing,
  dnsMode,
  outputMode,
  outputName,
})

const isPingScan = computed(() => scanType.value === 'ping')
const requiresPrivileges = computed(() => useSudo.value || osDetection.value || ['syn', 'udp', 'tcp-udp'].includes(scanType.value))
const commandState = computed(() => {
  try {
    return {
      command: buildNmapCommand({
        target: target.value,
        useSudo: useSudo.value,
        scanType: scanType.value,
        portMode: portMode.value,
        customPorts: customPorts.value,
        topPorts: topPorts.value,
        serviceVersion: serviceVersion.value,
        osDetection: osDetection.value,
        scriptPreset: scriptPreset.value,
        noPing: noPing.value,
        onlyOpen: onlyOpen.value,
        traceroute: traceroute.value,
        showReason: showReason.value,
        ipv6: ipv6.value,
        verbose: verbose.value,
        timing: timing.value,
        dnsMode: dnsMode.value,
        outputMode: outputMode.value,
        outputName: outputName.value,
      }),
      error: '',
    }
  } catch (reason) {
    return { command: '', error: reason instanceof Error ? reason.message : '参数无效' }
  }
})

const summary = computed(() => {
  const items = [
    { label: '扫描方式', value: ({ syn: 'TCP SYN', connect: 'TCP Connect', udp: 'UDP', 'tcp-udp': 'TCP + UDP', ping: '仅发现主机' })[scanType.value] },
    { label: '端口范围', value: isPingScan.value ? '不扫描端口' : ({ default: '默认 1,000 个', fast: '快速 100 个', top: `热门 ${topPorts.value} 个`, custom: customPorts.value, all: '全部 65,535 个' })[portMode.value] },
    { label: '速度模板', value: `T${timing.value}` },
  ]
  if (serviceVersion.value && !isPingScan.value) items.push({ label: '服务探测', value: '已启用' })
  if (osDetection.value && !isPingScan.value) items.push({ label: '系统探测', value: '已启用' })
  return items
})

function applyPreset(preset: 'quick' | 'service' | 'web' | 'inventory' | 'ping') {
  if (preset === 'quick') {
    scanType.value = 'syn'; portMode.value = 'fast'; serviceVersion.value = false; osDetection.value = false; scriptPreset.value = 'none'; timing.value = 4
  }
  if (preset === 'service') {
    scanType.value = 'connect'; portMode.value = 'default'; serviceVersion.value = true; osDetection.value = false; scriptPreset.value = 'default'; timing.value = 3
  }
  if (preset === 'web') {
    scanType.value = 'connect'; portMode.value = 'custom'; customPorts.value = '80,443,8080,8443'; serviceVersion.value = true; osDetection.value = false; scriptPreset.value = 'web'; timing.value = 3
  }
  if (preset === 'inventory') {
    scanType.value = 'syn'; portMode.value = 'top'; topPorts.value = 1000; serviceVersion.value = true; osDetection.value = true; scriptPreset.value = 'safe'; showReason.value = true; timing.value = 3
  }
  if (preset === 'ping') {
    scanType.value = 'ping'; serviceVersion.value = false; osDetection.value = false; scriptPreset.value = 'none'; noPing.value = false; timing.value = 3
  }
}
</script>

<template>
  <ToolPageHeader title="Nmap 命令生成器" description="通过可视化参数生成可复制的 Nmap 命令，页面不会执行任何扫描" :icon="RadarChartOutlined" color="#77548f" />

  <div class="nmap-layout">
    <div class="nmap-main">
      <ToolCard title="快速预设" description="先选择一个常见任务，再按需要微调参数。">
        <div class="preset-grid">
          <button @click="applyPreset('quick')"><strong>快速扫描</strong><span>常用 100 个端口</span></button>
          <button @click="applyPreset('service')"><strong>服务识别</strong><span>端口与版本信息</span></button>
          <button @click="applyPreset('web')"><strong>Web 服务</strong><span>HTTP / HTTPS 检查</span></button>
          <button @click="applyPreset('inventory')"><strong>资产盘点</strong><span>服务、系统与安全脚本</span></button>
          <button @click="applyPreset('ping')"><strong>主机发现</strong><span>仅判断主机是否在线</span></button>
        </div>
      </ToolCard>

      <ToolCard title="目标与扫描方式">
        <div class="form-grid">
          <div class="form-field full">
            <span class="field-label">扫描目标 <span class="field-hint">主机名、IP、CIDR 或地址范围</span></span>
            <a-input v-model:value="target" class="mono" size="large" placeholder="例如：192.168.1.0/24" />
          </div>
          <div class="form-field">
            <span class="field-label">扫描方式</span>
            <a-select v-model:value="scanType" size="large" style="width: 100%">
              <a-select-option value="syn">TCP SYN · -sS</a-select-option>
              <a-select-option value="connect">TCP Connect · -sT</a-select-option>
              <a-select-option value="udp">UDP · -sU</a-select-option>
              <a-select-option value="tcp-udp">TCP SYN + UDP</a-select-option>
              <a-select-option value="ping">仅发现主机 · -sn</a-select-option>
            </a-select>
          </div>
          <div class="form-field">
            <span class="field-label">时间模板 <span class="field-hint">T{{ timing }}</span></span>
            <a-slider v-model:value="timing" :min="0" :max="5" :marks="{ 0: '慢', 3: '正常', 5: '快' }" />
          </div>
          <div class="form-field full option-row">
            <a-checkbox v-model:checked="useSudo">命令前添加 sudo</a-checkbox>
            <a-checkbox v-model:checked="ipv6">IPv6 模式 -6</a-checkbox>
            <a-checkbox v-model:checked="verbose">显示详细过程 -v</a-checkbox>
          </div>
        </div>
      </ToolCard>

      <ToolCard title="端口范围" description="主机发现模式不会扫描端口。">
        <div class="form-grid">
          <div class="form-field">
            <span class="field-label">端口选择</span>
            <a-select v-model:value="portMode" size="large" :disabled="isPingScan" style="width: 100%">
              <a-select-option value="default">Nmap 默认端口</a-select-option>
              <a-select-option value="fast">快速模式 · -F</a-select-option>
              <a-select-option value="top">热门端口 · --top-ports</a-select-option>
              <a-select-option value="custom">自定义端口 · -p</a-select-option>
              <a-select-option value="all">全部端口 · -p-</a-select-option>
            </a-select>
          </div>
          <div v-if="portMode === 'top'" class="form-field">
            <span class="field-label">热门端口数量</span>
            <a-input-number v-model:value="topPorts" :min="1" :max="65535" :disabled="isPingScan" style="width: 100%" size="large" />
          </div>
          <div v-if="portMode === 'custom'" class="form-field">
            <span class="field-label">自定义端口</span>
            <a-input v-model:value="customPorts" class="mono" size="large" :disabled="isPingScan" placeholder="22,80,443,8000-8100" />
          </div>
          <div class="form-field full option-row">
            <a-checkbox v-model:checked="onlyOpen" :disabled="isPingScan">只显示开放端口 --open</a-checkbox>
            <a-checkbox v-model:checked="noPing" :disabled="isPingScan">跳过主机发现 -Pn</a-checkbox>
          </div>
        </div>
      </ToolCard>

      <ToolCard title="探测选项">
        <div class="form-grid">
          <div class="form-field full option-grid">
            <a-checkbox v-model:checked="serviceVersion" :disabled="isPingScan">服务与版本探测 -sV</a-checkbox>
            <a-checkbox v-model:checked="osDetection" :disabled="isPingScan">操作系统探测 -O</a-checkbox>
            <a-checkbox v-model:checked="traceroute">路由跟踪 --traceroute</a-checkbox>
            <a-checkbox v-model:checked="showReason">显示端口状态原因 --reason</a-checkbox>
          </div>
          <div class="form-field">
            <span class="field-label">NSE 脚本预设 <span class="field-hint">仅提供常用非侵入式集合</span></span>
            <a-select v-model:value="scriptPreset" size="large" :disabled="isPingScan" style="width: 100%">
              <a-select-option value="none">不运行脚本</a-select-option>
              <a-select-option value="default">默认脚本 · -sC</a-select-option>
              <a-select-option value="safe">Safe 分类</a-select-option>
              <a-select-option value="discovery">Discovery 分类</a-select-option>
              <a-select-option value="web">Web 标题与响应头</a-select-option>
              <a-select-option value="tls">TLS 证书与加密套件</a-select-option>
            </a-select>
          </div>
          <div class="form-field">
            <span class="field-label">DNS 解析</span>
            <a-select v-model:value="dnsMode" size="large" style="width: 100%">
              <a-select-option value="default">默认行为</a-select-option>
              <a-select-option value="none">不解析域名 · -n</a-select-option>
              <a-select-option value="always">始终解析 · -R</a-select-option>
            </a-select>
          </div>
        </div>
      </ToolCard>

      <ToolCard title="保存扫描结果">
        <div class="form-grid">
          <div class="form-field">
            <span class="field-label">输出格式</span>
            <a-select v-model:value="outputMode" size="large" style="width: 100%">
              <a-select-option value="none">仅输出到终端</a-select-option>
              <a-select-option value="normal">普通文本 · -oN</a-select-option>
              <a-select-option value="xml">XML · -oX</a-select-option>
              <a-select-option value="all">主要格式全部保存 · -oA</a-select-option>
            </a-select>
          </div>
          <div v-if="outputMode !== 'none'" class="form-field">
            <span class="field-label">文件名 / 基础名称</span>
            <a-input v-model:value="outputName" class="mono" size="large" placeholder="nmap-scan" />
          </div>
        </div>
      </ToolCard>
    </div>

    <aside class="nmap-aside">
      <ToolCard title="生成的命令" description="参数变化后会自动更新。">
        <a-alert v-if="commandState.error" type="error" show-icon :message="commandState.error" />
        <ResultPanel v-else :value="commandState.command" label="Nmap 命令" />
        <div class="command-summary">
          <div v-for="item in summary" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
        </div>
        <a-alert v-if="requiresPrivileges" class="privilege-alert" type="info" show-icon message="当前选项可能需要管理员或 root 权限" />
        <div class="responsible-note"><ThunderboltOutlined /> 只扫描你拥有或已获得明确授权的目标。</div>
      </ToolCard>
    </aside>
  </div>
</template>

<style scoped>
.nmap-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; align-items: start; gap: 18px; }
.nmap-main { min-width: 0; }
.nmap-aside { position: sticky; top: 82px; min-width: 0; }
.preset-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; }
.preset-grid button { min-height: 78px; padding: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-subtle); color: var(--text-main); text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease; }
.preset-grid button:hover { border-color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 7%, var(--panel-subtle)); }
.preset-grid strong, .preset-grid span { display: block; }
.preset-grid strong { margin-bottom: 6px; font-size: 13px; }
.preset-grid span { color: var(--text-muted); font-size: 11px; line-height: 1.45; }
.option-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.nmap-aside :deep(.result-panel) { margin-top: 0; }
.nmap-aside :deep(.result-panel pre) { min-height: 112px; }
.command-summary { margin-top: 14px; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; }
.command-summary > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 11px; border-bottom: 1px solid var(--line); font-size: 11px; }
.command-summary > div:last-child { border-bottom: 0; }
.command-summary span { color: var(--text-muted); }
.command-summary strong { overflow-wrap: anywhere; color: var(--text-main); text-align: right; }
.privilege-alert { margin-top: 14px; }
.responsible-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 14px; color: var(--text-muted); font-size: 11px; line-height: 1.6; }
@media (max-width: 1080px) { .nmap-layout { grid-template-columns: 1fr; } .nmap-aside { position: static; grid-row: 1; } .preset-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 640px) { .preset-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .option-grid { grid-template-columns: 1fr; } }
</style>
