<script setup lang="ts">
import { computed, reactive, toRefs } from 'vue'
import { BugOutlined, FileSearchOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { buildTcpdumpCommand, buildVisualFilter, defaultTcpdumpOptions } from '../utils/tcpdump'

const settings = reactive(defaultTcpdumpOptions())
rememberToolSettings('tcpdump-generator', toRefs(settings))

const isCapture = computed(() => settings.mode === 'capture')
const isRead = computed(() => settings.mode === 'read' || settings.mode === 'read-list')
const supportsFilter = computed(() => ['capture', 'read', 'read-list', 'compile-filter'].includes(settings.mode))
const supportsOutput = computed(() => ['capture', 'read', 'read-list'].includes(settings.mode))
const commandState = computed(() => {
  try { return { command: buildTcpdumpCommand(settings), error: '' } }
  catch (reason) { return { command: '', error: reason instanceof Error ? reason.message : '参数无效' } }
})
const visualFilter = computed(() => {
  try { return buildVisualFilter(settings) || '全部报文' }
  catch { return '过滤条件有误' }
})
const summary = computed(() => [
  { label: '运行模式', value: ({ capture: '实时捕获', read: '读取 pcap', 'read-list': '读取文件列表', 'list-interfaces': '列出接口', 'list-datalinks': '链路类型', 'list-timestamps': '时间戳类型', 'compile-filter': '编译过滤器' })[settings.mode] },
  { label: '数据来源', value: isCapture.value ? settings.interface || '自动接口' : isRead.value ? (settings.mode === 'read' ? settings.readFile : settings.fileList) : '—' },
  { label: '过滤规则', value: supportsFilter.value ? (settings.filterSource === 'builder' ? visualFilter.value : settings.filterSource === 'custom' ? settings.customExpression || '全部报文' : settings.filterFile || '过滤器文件') : '不适用' },
])

function applyPreset(preset: 'http' | 'dns' | 'syn' | 'pcap' | 'read' | 'interfaces') {
  const interfaceName = settings.interface
  Object.assign(settings, defaultTcpdumpOptions(), { interface: interfaceName })
  if (preset === 'http') Object.assign(settings, { filterSource: 'custom', customExpression: 'tcp port 80 or tcp port 443', nameResolution: 'numeric', verbosity: 1 })
  if (preset === 'dns') Object.assign(settings, { protocol: 'udp', portMode: 'single', port: 53, nameResolution: 'numeric', verbosity: 1 })
  if (preset === 'syn') Object.assign(settings, { protocol: 'tcp', tcpFlags: 'syn', nameResolution: 'numeric' })
  if (preset === 'pcap') Object.assign(settings, { writeFile: 'captures/capture-%Y%m%d-%H%M%S.pcap', rotateSize: '100M', rotateSeconds: 3600, fileCount: 24 })
  if (preset === 'read') Object.assign(settings, { mode: 'read', useSudo: false, readFile: 'capture.pcap', nameResolution: 'numeric', verbosity: 1 })
  if (preset === 'interfaces') Object.assign(settings, { mode: 'list-interfaces', useSudo: false })
}
</script>

<template>
  <ToolPageHeader title="tcpdump 命令生成器" description="可视化配置网络捕获、pcap 分析与 BPF 过滤条件，页面只生成命令" :icon="BugOutlined" color="#8a5f3a" />

  <div class="tcpdump-layout">
    <div class="tcpdump-main">
      <ToolCard title="常用场景" description="从常用任务开始，再按需要调整完整参数。">
        <div class="preset-grid">
          <button @click="applyPreset('http')"><strong>HTTP / HTTPS</strong><span>80 与 443 端口</span></button>
          <button @click="applyPreset('dns')"><strong>DNS 请求</strong><span>UDP 53 端口</span></button>
          <button @click="applyPreset('syn')"><strong>TCP SYN</strong><span>新连接请求</span></button>
          <button @click="applyPreset('pcap')"><strong>轮转保存</strong><span>按时间和大小保存 pcap</span></button>
          <button @click="applyPreset('read')"><strong>读取 pcap</strong><span>离线分析捕获文件</span></button>
          <button @click="applyPreset('interfaces')"><strong>列出接口</strong><span>生成 tcpdump -D</span></button>
        </div>
      </ToolCard>

      <ToolCard title="运行模式与数据源">
        <div class="form-grid">
          <div class="form-field full">
            <span class="field-label">运行模式</span>
            <a-select v-model:value="settings.mode" size="large" style="width: 100%">
              <a-select-option value="capture">实时捕获网络接口</a-select-option>
              <a-select-option value="read">读取单个 pcap / pcapng 文件</a-select-option>
              <a-select-option value="read-list">读取文件列表 · -V</a-select-option>
              <a-select-option value="list-interfaces">列出可用接口 · -D</a-select-option>
              <a-select-option value="list-datalinks">列出接口链路类型 · -L</a-select-option>
              <a-select-option value="list-timestamps">列出时间戳类型 · -J</a-select-option>
              <a-select-option value="compile-filter">编译并查看 BPF · -d/-dd/-ddd</a-select-option>
            </a-select>
          </div>
          <div v-if="['capture','list-datalinks','list-timestamps','compile-filter'].includes(settings.mode)" class="form-field">
            <span class="field-label">网络接口 <span class="field-hint">Linux 可使用 any</span></span>
            <a-input v-model:value="settings.interface" class="mono" size="large" placeholder="例如 eth0、en0 或 any" />
          </div>
          <div v-if="settings.mode === 'read'" class="form-field">
            <span class="field-label">pcap 文件</span>
            <a-input v-model:value="settings.readFile" class="mono" size="large" placeholder="capture.pcap" />
          </div>
          <div v-if="settings.mode === 'read-list'" class="form-field">
            <span class="field-label">文件列表</span>
            <a-input v-model:value="settings.fileList" class="mono" size="large" placeholder="pcap-files.txt" />
          </div>
          <div v-if="settings.mode === 'compile-filter'" class="form-field">
            <span class="field-label">BPF 输出格式</span>
            <a-select v-model:value="settings.compileFormat" size="large" style="width: 100%">
              <a-select-option value="human">可读格式 · -d</a-select-option>
              <a-select-option value="c">C 数组 · -dd</a-select-option>
              <a-select-option value="decimal">十进制指令 · -ddd</a-select-option>
            </a-select>
          </div>
          <div v-if="settings.mode !== 'list-interfaces'" class="form-field full option-row">
            <a-checkbox v-model:checked="settings.useSudo">命令前添加 sudo</a-checkbox>
            <a-checkbox v-model:checked="settings.monitorMode" :disabled="!isCapture && settings.mode !== 'list-datalinks'">Wi-Fi Monitor 模式 · -I</a-checkbox>
          </div>
        </div>
      </ToolCard>

      <ToolCard v-if="supportsFilter" title="BPF 报文过滤器" description="多个可视化条件使用 AND 组合；复杂规则可切换到自定义表达式。">
        <div class="form-field full filter-source">
          <a-segmented v-model:value="settings.filterSource" :options="[{ label: '可视化条件', value: 'builder' }, { label: '自定义 BPF', value: 'custom' }, { label: '过滤器文件', value: 'file' }]" block />
        </div>
        <div v-if="settings.filterSource === 'builder'" class="form-grid three">
          <div class="form-field"><span class="field-label">协议</span><a-select v-model:value="settings.protocol" style="width: 100%"><a-select-option value="">全部</a-select-option><a-select-option value="tcp">TCP</a-select-option><a-select-option value="udp">UDP</a-select-option><a-select-option value="icmp">ICMP</a-select-option><a-select-option value="icmp6">ICMPv6</a-select-option><a-select-option value="arp">ARP</a-select-option><a-select-option value="ip">IPv4</a-select-option><a-select-option value="ip6">IPv6</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">主机方向</span><a-select v-model:value="settings.hostDirection" style="width: 100%"><a-select-option value="">任意方向</a-select-option><a-select-option value="src">来源主机</a-select-option><a-select-option value="dst">目标主机</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">主机</span><a-input v-model:value="settings.host" class="mono" placeholder="IP 或主机名" /></div>
          <div class="form-field"><span class="field-label">网段方向</span><a-select v-model:value="settings.netDirection" style="width: 100%"><a-select-option value="">任意方向</a-select-option><a-select-option value="src">来源网段</a-select-option><a-select-option value="dst">目标网段</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">网段</span><a-input v-model:value="settings.network" class="mono" placeholder="例如 10.0.0.0/8" /></div>
          <div class="form-field"><span class="field-label">端口方向</span><a-select v-model:value="settings.portDirection" style="width: 100%"><a-select-option value="">任意方向</a-select-option><a-select-option value="src">来源端口</a-select-option><a-select-option value="dst">目标端口</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">端口模式</span><a-select v-model:value="settings.portMode" style="width: 100%"><a-select-option value="none">不限端口</a-select-option><a-select-option value="single">单个端口</a-select-option><a-select-option value="range">端口范围</a-select-option></a-select></div>
          <div v-if="settings.portMode === 'single'" class="form-field"><span class="field-label">端口</span><a-input-number v-model:value="settings.port" :min="1" :max="65535" style="width: 100%" /></div>
          <div v-if="settings.portMode === 'range'" class="form-field"><span class="field-label">端口范围</span><a-input v-model:value="settings.portRange" class="mono" placeholder="8000-8100" /></div>
          <div class="form-field"><span class="field-label">TCP Flags</span><a-select v-model:value="settings.tcpFlags" style="width: 100%"><a-select-option value="none">不限</a-select-option><a-select-option value="syn">仅 SYN</a-select-option><a-select-option value="syn-ack">SYN + ACK</a-select-option><a-select-option value="rst">RST</a-select-option><a-select-option value="fin">FIN</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">报文长度</span><a-select v-model:value="settings.lengthOperator" style="width: 100%"><a-select-option value="none">不限</a-select-option><a-select-option value="greater">大于</a-select-option><a-select-option value="less">小于</a-select-option></a-select></div>
          <div v-if="settings.lengthOperator !== 'none'" class="form-field"><span class="field-label">长度字节数</span><a-input-number v-model:value="settings.packetLength" :min="1" :max="65535" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">VLAN ID <span class="field-hint">-1 不限制</span></span><a-input-number v-model:value="settings.vlanId" :min="-1" :max="4095" style="width: 100%" /></div>
          <div class="form-field full"><a-checkbox v-model:checked="settings.excludeHost" :disabled="!settings.host">排除该主机</a-checkbox></div>
          <div class="filter-preview form-field full"><span>组合结果</span><code>{{ visualFilter }}</code></div>
        </div>
        <div v-else-if="settings.filterSource === 'custom'" class="form-field">
          <span class="field-label">自定义 BPF 表达式</span>
          <a-textarea v-model:value="settings.customExpression" :rows="4" class="mono" placeholder="例如 (tcp port 80 or tcp port 443) and not host 10.0.0.1" />
        </div>
        <div v-else class="form-field">
          <span class="field-label">过滤器文件 <span class="field-hint">-F</span></span>
          <a-input v-model:value="settings.filterFile" class="mono" placeholder="filters.bpf" />
        </div>
      </ToolCard>

      <ToolCard v-if="isCapture || isRead || settings.mode === 'compile-filter'" title="捕获与解析参数">
        <div class="form-grid three">
          <div class="form-field"><span class="field-label">处理报文数量 <span class="field-hint">0 不限制</span></span><a-input-number v-model:value="settings.packetCount" :min="0" :max="1000000000" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">跳过前 N 个报文</span><a-input-number v-model:value="settings.skipCount" :min="0" :max="1000000000" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">Snaplen <span class="field-hint">0 使用默认</span></span><a-input-number v-model:value="settings.snaplen" :min="0" :max="262144" style="width: 100%" /></div>
          <div v-if="isCapture" class="form-field"><span class="field-label">内核缓冲区 <span class="field-hint">KiB</span></span><a-input-number v-model:value="settings.bufferSize" :min="0" :max="1048576" style="width: 100%" /></div>
          <div v-if="isCapture" class="form-field"><span class="field-label">捕获方向</span><a-select v-model:value="settings.direction" style="width: 100%"><a-select-option value="">系统默认</a-select-option><a-select-option value="in">仅进入</a-select-option><a-select-option value="out">仅发出</a-select-option><a-select-option value="inout">双向</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">时间戳精度</span><a-select v-model:value="settings.timestampPrecision" style="width: 100%"><a-select-option value="default">默认</a-select-option><a-select-option value="micro">微秒</a-select-option><a-select-option value="nano">纳秒</a-select-option></a-select></div>
          <div v-if="isCapture" class="form-field"><span class="field-label">时间戳类型</span><a-input v-model:value="settings.timestampType" class="mono" placeholder="例如 host、adapter" /></div>
          <div class="form-field"><span class="field-label">链路类型</span><a-input v-model:value="settings.datalinkType" class="mono" placeholder="例如 EN10MB" /></div>
          <div class="form-field"><span class="field-label">强制解析协议 <span class="field-hint">-T</span></span><a-input v-model:value="settings.forceProtocol" class="mono" placeholder="例如 quic、domain、rtp" /></div>
          <div class="form-field full option-grid">
            <a-checkbox v-model:checked="settings.immediateMode" :disabled="!isCapture">立即模式</a-checkbox>
            <a-checkbox v-model:checked="settings.noPromiscuous" :disabled="!isCapture">关闭混杂模式</a-checkbox>
            <a-checkbox v-model:checked="settings.noChecksum">不校验 Checksum</a-checkbox>
            <a-checkbox v-model:checked="settings.noOptimize">禁用 BPF 优化</a-checkbox>
            <a-checkbox v-model:checked="settings.countOnly" :disabled="!isRead">读取时只统计数量</a-checkbox>
          </div>
        </div>
      </ToolCard>

      <ToolCard v-if="supportsOutput" title="终端显示">
        <div class="form-grid three">
          <div class="form-field"><span class="field-label">报文内容格式</span><a-select v-model:value="settings.packetFormat" style="width: 100%"><a-select-option value="summary">仅解析摘要</a-select-option><a-select-option value="ascii">ASCII · -A</a-select-option><a-select-option value="hex">Hex · -x</a-select-option><a-select-option value="hex-link">Hex 含链路头 · -xx</a-select-option><a-select-option value="hex-ascii">Hex + ASCII · -X</a-select-option><a-select-option value="hex-ascii-link">Hex + ASCII 含链路头 · -XX</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">详细程度 <span class="field-hint">v × {{ settings.verbosity }}</span></span><a-slider v-model:value="settings.verbosity" :min="0" :max="3" :marks="{ 0: '默认', 3: '最详' }" /></div>
          <div class="form-field"><span class="field-label">名称解析</span><a-select v-model:value="settings.nameResolution" style="width: 100%"><a-select-option value="default">默认解析</a-select-option><a-select-option value="no-address">地址和端口不解析 · -n</a-select-option><a-select-option value="numeric">完全数字化 · -nn</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">时间戳显示</span><a-select v-model:value="settings.timestampDisplay" style="width: 100%"><a-select-option value="default">默认</a-select-option><a-select-option value="none">不显示 · -t</a-select-option><a-select-option value="unix">Unix 时间 · -tt</a-select-option><a-select-option value="delta">与上一包间隔 · -ttt</a-select-option><a-select-option value="date">日期时间 · -tttt</a-select-option><a-select-option value="delta-first">与首包间隔 · -ttttt</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">打印采样 <span class="field-hint">每 N 包，0 关闭</span></span><a-input-number v-model:value="settings.printSampling" :min="0" :max="1000000000" style="width: 100%" /></div>
          <div class="form-field full option-grid">
            <a-checkbox v-model:checked="settings.linkHeader">显示链路层头 · -e</a-checkbox>
            <a-checkbox v-model:checked="settings.absoluteSequence">绝对 TCP 序列号 · -S</a-checkbox>
            <a-checkbox v-model:checked="settings.quiet">精简输出 · -q</a-checkbox>
            <a-checkbox v-model:checked="settings.lineBuffered">行缓冲 · -l</a-checkbox>
            <a-checkbox v-model:checked="settings.packetBuffered">报文缓冲 · -U</a-checkbox>
            <a-checkbox v-model:checked="settings.packetNumber">显示报文编号</a-checkbox>
            <a-checkbox v-model:checked="settings.printLengths">显示捕获与原始长度</a-checkbox>
            <a-checkbox v-model:checked="settings.ipOneline">IP 头保持单行 · -g</a-checkbox>
            <a-checkbox v-model:checked="settings.foreignNumeric">外部 IPv4 数字化 · -f</a-checkbox>
          </div>
        </div>
      </ToolCard>

      <ToolCard v-if="supportsOutput" title="pcap 保存与轮转" description="输出文件留空时仅显示到终端。">
        <div class="form-grid">
          <div class="form-field full"><span class="field-label">输出 pcap 文件 <span class="field-hint">-w，可使用 strftime 占位符</span></span><a-input v-model:value="settings.writeFile" class="mono" placeholder="captures/capture-%Y%m%d-%H%M%S.pcap" /></div>
          <div class="form-field"><span class="field-label">按大小轮转 <span class="field-hint">-C，例如 100M</span></span><a-input v-model:value="settings.rotateSize" class="mono" :disabled="!settings.writeFile" /></div>
          <div class="form-field"><span class="field-label">按时间轮转 <span class="field-hint">秒，-G</span></span><a-input-number v-model:value="settings.rotateSeconds" :min="0" :max="31536000" :disabled="!settings.writeFile" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">最多保留文件数 <span class="field-hint">-W</span></span><a-input-number v-model:value="settings.fileCount" :min="0" :max="1000000" :disabled="!settings.writeFile" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">轮转后压缩 <span class="field-hint">-z</span></span><a-select v-model:value="settings.postRotate" :disabled="!settings.writeFile" style="width: 100%"><a-select-option value="">不处理</a-select-option><a-select-option value="gzip">gzip</a-select-option><a-select-option value="bzip2">bzip2</a-select-option><a-select-option value="xz">xz</a-select-option></a-select></div>
          <div class="form-field full"><a-checkbox v-model:checked="settings.printWhileWriting" :disabled="!settings.writeFile">保存 pcap 时同时打印解析结果 · --print</a-checkbox></div>
        </div>
      </ToolCard>

      <ToolCard v-if="settings.mode !== 'list-interfaces'" title="权限与系统">
        <div class="form-grid">
          <div class="form-field"><span class="field-label">打开接口后降权到用户 <span class="field-hint">-Z</span></span><a-input v-model:value="settings.dropUser" class="mono" placeholder="例如 nobody" /></div>
        </div>
      </ToolCard>
    </div>

    <aside class="tcpdump-aside">
      <ToolCard title="生成的命令" description="参数变化后实时更新。">
        <a-alert v-if="commandState.error" type="error" show-icon :message="commandState.error" />
        <ResultPanel v-else :value="commandState.command" label="tcpdump 命令" />
        <div class="command-summary">
          <div v-for="item in summary" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
        </div>
        <div v-if="isCapture && settings.useSudo" class="privilege-note"><FileSearchOutlined /> 实时抓包通常需要 root 或报文捕获权限。</div>
        <div class="responsible-note"><ThunderboltOutlined /> 捕获内容可能包含敏感数据，请仅在获授权的网络和设备上使用。</div>
      </ToolCard>
    </aside>
  </div>
</template>

<style scoped>
.tcpdump-layout { display: grid; grid-template-columns: minmax(0, 1fr) 370px; align-items: start; gap: 18px; }
.tcpdump-main { min-width: 0; }
.tcpdump-aside { position: sticky; top: 82px; min-width: 0; }
.preset-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.preset-grid button { min-height: 72px; padding: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-subtle); color: var(--text-main); text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease; }
.preset-grid button:hover { border-color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 7%, var(--panel-subtle)); }
.preset-grid strong, .preset-grid span { display: block; }
.preset-grid strong { margin-bottom: 5px; font-size: 13px; }
.preset-grid span { color: var(--text-muted); font-size: 11px; line-height: 1.45; }
.filter-source { margin-bottom: 20px; }
.filter-preview { display: flex; align-items: flex-start; gap: 12px; padding: 11px 13px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-subtle); }
.filter-preview span { flex: 0 0 auto; color: var(--text-muted); font-size: 11px; }
.filter-preview code { overflow-wrap: anywhere; color: var(--primary-color); font-size: 12px; }
.option-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.tcpdump-aside :deep(.result-panel) { margin-top: 0; }
.tcpdump-aside :deep(.result-panel pre) { min-height: 140px; }
.command-summary { margin-top: 14px; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; }
.command-summary > div { display: flex; justify-content: space-between; gap: 14px; padding: 9px 11px; border-bottom: 1px solid var(--line); font-size: 11px; }
.command-summary > div:last-child { border-bottom: 0; }
.command-summary span { flex: 0 0 auto; color: var(--text-muted); }
.command-summary strong { overflow-wrap: anywhere; color: var(--text-main); text-align: right; }
.privilege-note, .responsible-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 14px; color: var(--text-muted); font-size: 11px; line-height: 1.6; }
@media (max-width: 1100px) { .tcpdump-layout { grid-template-columns: 1fr; } .tcpdump-aside { position: static; grid-row: 1; } }
@media (max-width: 640px) { .preset-grid, .option-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 420px) { .preset-grid, .option-grid { grid-template-columns: 1fr; } }
</style>
