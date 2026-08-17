<script setup lang="ts">
import { computed, reactive, toRefs } from 'vue'
import { DashboardOutlined, SwapOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { buildIperf3Command, defaultIperf3Options } from '../utils/iperf3'

const settings = reactive(defaultIperf3Options())
rememberToolSettings('iperf3-generator', toRefs(settings))

const isClient = computed(() => settings.mode === 'client')
const isUdp = computed(() => settings.protocol === 'udp')
const isSctp = computed(() => settings.protocol === 'sctp')
const commandState = computed(() => {
  try { return { command: buildIperf3Command(settings), error: '' } }
  catch (reason) { return { command: '', error: reason instanceof Error ? reason.message : '参数无效' } }
})
const summary = computed(() => {
  const result = [
    { label: '运行模式', value: isClient.value ? '客户端' : '服务端' },
    { label: '端口', value: String(settings.port) },
  ]
  if (isClient.value) {
    result.push({ label: '传输协议', value: settings.protocol.toUpperCase() })
    result.push({ label: '测试方向', value: ({ forward: '上传', reverse: '下载', bidir: '双向同时' })[settings.direction] })
    result.push({ label: '并行流', value: `${settings.parallel} 条` })
  }
  return result
})

function applyPreset(preset: 'tcp' | 'download' | 'bidir' | 'udp' | 'parallel' | 'server') {
  const host = settings.host
  const port = settings.port
  const defaults = defaultIperf3Options()
  Object.assign(settings, defaults, { host, port })
  if (preset === 'tcp') Object.assign(settings, { mode: 'client', protocol: 'tcp', duration: 10 })
  if (preset === 'download') Object.assign(settings, { mode: 'client', protocol: 'tcp', direction: 'reverse', duration: 10 })
  if (preset === 'bidir') Object.assign(settings, { mode: 'client', protocol: 'tcp', direction: 'bidir', duration: 15 })
  if (preset === 'udp') Object.assign(settings, { mode: 'client', protocol: 'udp', bitrate: '100M', duration: 10, udpCounters64: true })
  if (preset === 'parallel') Object.assign(settings, { mode: 'client', protocol: 'tcp', parallel: 4, duration: 20, omit: 2 })
  if (preset === 'server') Object.assign(settings, { mode: 'server', serverOneOff: false })
}
</script>

<template>
  <ToolPageHeader title="iperf3 命令生成器" description="可视化配置服务端与客户端吞吐量测试，页面只生成命令，不会连接或执行测试" :icon="DashboardOutlined" color="#39728a" />

  <div class="iperf-layout">
    <div class="iperf-main">
      <ToolCard title="常用场景" description="选择一个预设即可得到可用命令，所有参数仍可继续调整。">
        <div class="preset-grid">
          <button @click="applyPreset('tcp')"><strong>TCP 上传</strong><span>标准 10 秒测试</span></button>
          <button @click="applyPreset('download')"><strong>TCP 下载</strong><span>服务端向客户端发送</span></button>
          <button @click="applyPreset('bidir')"><strong>双向测试</strong><span>同时上传与下载</span></button>
          <button @click="applyPreset('udp')"><strong>UDP 100M</strong><span>丢包、抖动与吞吐量</span></button>
          <button @click="applyPreset('parallel')"><strong>4 路并发</strong><span>多流 TCP 性能</span></button>
          <button @click="applyPreset('server')"><strong>启动服务端</strong><span>监听默认 5201 端口</span></button>
        </div>
      </ToolCard>

      <ToolCard title="模式与连接">
        <div class="form-grid">
          <div class="form-field full">
            <span class="field-label">运行模式</span>
            <a-segmented v-model:value="settings.mode" :options="[{ label: '客户端 · 发起测试', value: 'client' }, { label: '服务端 · 等待连接', value: 'server' }]" block />
          </div>
          <div v-if="isClient" class="form-field">
            <span class="field-label">服务端地址</span>
            <a-input v-model:value="settings.host" class="mono" size="large" placeholder="192.168.1.10 或 iperf.example.com" />
          </div>
          <div class="form-field">
            <span class="field-label">服务端端口 <span class="field-hint">默认 5201</span></span>
            <a-input-number v-model:value="settings.port" :min="1" :max="65535" size="large" style="width: 100%" />
          </div>
          <div v-if="isClient" class="form-field">
            <span class="field-label">测试协议</span>
            <a-segmented v-model:value="settings.protocol" :options="[{ label: 'TCP', value: 'tcp' }, { label: 'UDP', value: 'udp' }, { label: 'SCTP', value: 'sctp' }]" block />
          </div>
          <div class="form-field">
            <span class="field-label">IP 版本</span>
            <a-select v-model:value="settings.ipVersion" size="large" style="width: 100%">
              <a-select-option value="auto">自动选择</a-select-option>
              <a-select-option value="4">强制 IPv4 · -4</a-select-option>
              <a-select-option value="6">强制 IPv6 · -6</a-select-option>
            </a-select>
          </div>
          <div class="form-field">
            <span class="field-label">绑定本地地址 <span class="field-hint">可选</span></span>
            <a-input v-model:value="settings.bindAddress" class="mono" size="large" placeholder="例如 192.168.1.20" />
          </div>
          <div class="form-field">
            <span class="field-label">绑定网络接口 <span class="field-hint">Linux / 部分系统</span></span>
            <a-input v-model:value="settings.bindDevice" class="mono" size="large" placeholder="例如 eth0" />
          </div>
        </div>
      </ToolCard>

      <ToolCard v-if="isClient" title="测试负载">
        <div class="form-grid">
          <div class="form-field full">
            <span class="field-label">测试方向</span>
            <a-segmented v-model:value="settings.direction" :options="[{ label: '上传', value: 'forward' }, { label: '下载 · -R', value: 'reverse' }, { label: '双向同时 · --bidir', value: 'bidir' }]" block />
          </div>
          <div class="form-field">
            <span class="field-label">结束条件</span>
            <a-select v-model:value="settings.limitMode" size="large" style="width: 100%">
              <a-select-option value="time">按时间 · -t</a-select-option>
              <a-select-option value="bytes">按字节数 · -n</a-select-option>
              <a-select-option value="blocks">按数据块 · -k</a-select-option>
            </a-select>
          </div>
          <div v-if="settings.limitMode === 'time'" class="form-field">
            <span class="field-label">测试时长 <span class="field-hint">秒，0 表示持续运行</span></span>
            <a-input-number v-model:value="settings.duration" :min="0" :max="86400" size="large" style="width: 100%" />
          </div>
          <div v-if="settings.limitMode === 'bytes'" class="form-field">
            <span class="field-label">传输字节数</span>
            <a-input v-model:value="settings.bytes" class="mono" size="large" placeholder="例如 100M 或 1G" />
          </div>
          <div v-if="settings.limitMode === 'blocks'" class="form-field">
            <span class="field-label">数据块数量</span>
            <a-input v-model:value="settings.blocks" class="mono" size="large" placeholder="例如 1000 或 1M" />
          </div>
          <div class="form-field">
            <span class="field-label">并行流数量 <span class="field-hint">-P</span></span>
            <a-input-number v-model:value="settings.parallel" :min="1" :max="128" size="large" style="width: 100%" />
          </div>
          <div class="form-field">
            <span class="field-label">预热并忽略 <span class="field-hint">秒，-O</span></span>
            <a-input-number v-model:value="settings.omit" :min="0" :max="3600" size="large" style="width: 100%" />
          </div>
          <div class="form-field">
            <span class="field-label">目标速率 <span class="field-hint">-b，TCP 留空为不限速</span></span>
            <a-input v-model:value="settings.bitrate" class="mono" size="large" :placeholder="isUdp ? '例如 100M' : '例如 1G，可留空'" />
          </div>
          <div class="form-field">
            <span class="field-label">突发包数量 <span class="field-hint">配合 -b 使用</span></span>
            <a-input-number v-model:value="settings.burst" :min="0" :max="1000000" size="large" style="width: 100%" />
          </div>
          <div class="form-field">
            <span class="field-label">读写缓冲区长度 <span class="field-hint">-l</span></span>
            <a-input v-model:value="settings.length" class="mono" size="large" placeholder="例如 128K 或 1400" />
          </div>
          <div class="form-field">
            <span class="field-label">Socket 窗口 / 缓冲区 <span class="field-hint">-w</span></span>
            <a-input v-model:value="settings.window" class="mono" size="large" placeholder="例如 1M" />
          </div>
        </div>
      </ToolCard>

      <ToolCard v-if="isClient" title="协议与性能高级选项" description="空值或 0 表示使用 iperf3 / 操作系统默认值。">
        <div class="form-grid three">
          <div class="form-field"><span class="field-label">连接超时 <span class="field-hint">毫秒</span></span><a-input-number v-model:value="settings.connectTimeout" :min="0" :max="3600000" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">客户端端口</span><a-input-number v-model:value="settings.clientPort" :min="0" :max="65535" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">MSS <span class="field-hint">TCP/SCTP</span></span><a-input-number v-model:value="settings.mss" :min="0" :max="65535" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">Pacing 定时器 <span class="field-hint">微秒</span></span><a-input-number v-model:value="settings.pacingTimer" :min="0" :max="10000000" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">FQ Socket 速率</span><a-input v-model:value="settings.fqRate" class="mono" placeholder="例如 1G" /></div>
          <div class="form-field"><span class="field-label">拥塞控制算法</span><a-input v-model:value="settings.congestion" class="mono" placeholder="例如 cubic 或 bbr" /></div>
          <div class="form-field"><span class="field-label">TOS</span><a-input v-model:value="settings.tos" class="mono" placeholder="例如 0x34" /></div>
          <div class="form-field"><span class="field-label">DSCP</span><a-input v-model:value="settings.dscp" class="mono" placeholder="例如 EF 或 46" /></div>
          <div class="form-field"><span class="field-label">IPv6 Flow Label</span><a-input v-model:value="settings.flowLabel" class="mono" placeholder="例如 0x12345" /></div>
          <div v-if="isSctp" class="form-field"><span class="field-label">SCTP Stream 数量</span><a-input-number v-model:value="settings.nstreams" :min="0" :max="65535" style="width: 100%" /></div>
          <div v-if="isSctp" class="form-field full"><span class="field-label">SCTP 绑定地址 <span class="field-hint">多个地址用逗号分隔</span></span><a-input v-model:value="settings.xbind" class="mono" /></div>
          <div class="form-field full option-grid">
            <a-checkbox v-model:checked="settings.noDelay" :disabled="isUdp">禁用 Nagle · -N</a-checkbox>
            <a-checkbox v-model:checked="settings.zeroCopy" :disabled="!(!isUdp && !isSctp)">Zero Copy · -Z</a-checkbox>
            <a-checkbox v-model:checked="settings.skipRxCopy">跳过接收复制</a-checkbox>
            <a-checkbox v-model:checked="settings.repeatingPayload">重复 Payload</a-checkbox>
            <a-checkbox v-model:checked="settings.dontFragment" :disabled="!isUdp || settings.ipVersion === '6'">IPv4 UDP 不分片</a-checkbox>
            <a-checkbox v-model:checked="settings.udpCounters64" :disabled="!isUdp">UDP 64 位计数器</a-checkbox>
            <a-checkbox v-model:checked="settings.mptcp" :disabled="isUdp || isSctp">MPTCP · -m</a-checkbox>
            <a-checkbox v-model:checked="settings.getServerOutput">获取服务端输出</a-checkbox>
          </div>
          <div class="form-field full"><span class="field-label">文件作为数据源 / 接收端 <span class="field-hint">UDP 不支持</span></span><a-input v-model:value="settings.filePath" class="mono" :disabled="isUdp" placeholder="例如 /tmp/test.bin" /></div>
        </div>
      </ToolCard>

      <ToolCard v-else title="服务端选项">
        <div class="form-grid">
          <div class="form-field full option-grid">
            <a-checkbox v-model:checked="settings.serverDaemon">后台守护进程 · -D</a-checkbox>
            <a-checkbox v-model:checked="settings.serverOneOff">服务一个客户端后退出 · -1</a-checkbox>
          </div>
          <div class="form-field"><span class="field-label">空闲超时 <span class="field-hint">秒</span></span><a-input-number v-model:value="settings.serverIdleTimeout" :min="0" :max="86400" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">最大测试时长 <span class="field-hint">秒</span></span><a-input-number v-model:value="settings.serverMaxDuration" :min="0" :max="86400" style="width: 100%" /></div>
          <div class="form-field full"><span class="field-label">服务端速率限制 <span class="field-hint">例如 1G 或 1G/5</span></span><a-input v-model:value="settings.serverBitrateLimit" class="mono" /></div>
        </div>
      </ToolCard>

      <ToolCard title="输出与诊断">
        <div class="form-grid three">
          <div class="form-field"><span class="field-label">输出模式</span><a-select v-model:value="settings.outputMode" style="width: 100%"><a-select-option value="human">易读文本</a-select-option><a-select-option value="json">完整 JSON · -J</a-select-option><a-select-option value="json-stream">实时 JSON 流</a-select-option></a-select></div>
          <div class="form-field"><span class="field-label">报告间隔 <span class="field-hint">秒，0 关闭</span></span><a-input-number v-model:value="settings.interval" :min="0" :max="3600" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">报告单位</span><a-select v-model:value="settings.reportFormat" style="width: 100%"><a-select-option value="">自动</a-select-option><a-select-option value="k">Kbits</a-select-option><a-select-option value="m">Mbits</a-select-option><a-select-option value="g">Gbits</a-select-option><a-select-option value="K">KBytes</a-select-option><a-select-option value="M">MBytes</a-select-option><a-select-option value="G">GBytes</a-select-option></a-select></div>
          <div class="form-field full option-grid">
            <a-checkbox v-model:checked="settings.jsonStreamFull" :disabled="settings.outputMode !== 'json-stream'">JSON 流包含完整输出</a-checkbox>
            <a-checkbox v-model:checked="settings.forceFlush">每个间隔强制刷新输出</a-checkbox>
            <a-checkbox v-model:checked="settings.timestamps">每行添加时间戳</a-checkbox>
            <a-checkbox v-model:checked="settings.verbose">详细输出 · -V</a-checkbox>
            <a-checkbox v-model:checked="settings.debug">调试输出 · -d</a-checkbox>
          </div>
          <div v-if="settings.timestamps" class="form-field full"><span class="field-label">时间戳格式 <span class="field-hint">可选，strftime 格式</span></span><a-input v-model:value="settings.timestampFormat" class="mono" placeholder="例如 %Y-%m-%d %H:%M:%S" /></div>
          <div class="form-field"><span class="field-label">日志文件</span><a-input v-model:value="settings.logfile" class="mono" placeholder="例如 /tmp/iperf3.log" /></div>
          <div class="form-field"><span class="field-label">PID 文件</span><a-input v-model:value="settings.pidFile" class="mono" placeholder="例如 /run/iperf3.pid" /></div>
          <div v-if="isClient" class="form-field"><span class="field-label">输出标题</span><a-input v-model:value="settings.title" placeholder="例如 Office uplink" /></div>
          <div v-if="isClient" class="form-field"><span class="field-label">JSON 附加数据</span><a-input v-model:value="settings.extraData" placeholder="例如 test-id-001" /></div>
        </div>
      </ToolCard>

      <ToolCard title="系统、超时与认证" description="认证依赖带 OpenSSL 支持的 iperf3；密码不会出现在命令或浏览器缓存中。">
        <div class="form-grid three">
          <div class="form-field"><span class="field-label">CPU 亲和性</span><a-input v-model:value="settings.affinity" class="mono" placeholder="2 或 2/3" /></div>
          <div class="form-field"><span class="field-label">接收超时 <span class="field-hint">毫秒</span></span><a-input-number v-model:value="settings.rcvTimeout" :min="0" :max="86400000" style="width: 100%" /></div>
          <div class="form-field"><span class="field-label">发送超时 <span class="field-hint">毫秒</span></span><a-input-number v-model:value="settings.sndTimeout" :min="0" :max="86400000" style="width: 100%" /></div>
          <template v-if="isClient">
            <div class="form-field"><span class="field-label">认证用户名</span><a-input v-model:value="settings.username" autocomplete="off" /></div>
            <div class="form-field"><span class="field-label">RSA 公钥路径</span><a-input v-model:value="settings.rsaPublicKey" class="mono" /></div>
          </template>
          <template v-else>
            <div class="form-field"><span class="field-label">RSA 私钥路径</span><a-input v-model:value="settings.rsaPrivateKey" class="mono" /></div>
            <div class="form-field"><span class="field-label">授权用户文件</span><a-input v-model:value="settings.authorizedUsers" class="mono" /></div>
            <div class="form-field"><span class="field-label">允许时间偏差 <span class="field-hint">秒</span></span><a-input-number v-model:value="settings.timeSkewThreshold" :min="0" :max="86400" style="width: 100%" /></div>
          </template>
          <div class="form-field full"><a-checkbox v-model:checked="settings.usePkcs1Padding">兼容旧版 PKCS#1 Padding（安全性较低，仅旧版本互通时使用）</a-checkbox></div>
        </div>
      </ToolCard>
    </div>

    <aside class="iperf-aside">
      <ToolCard title="生成的命令" description="参数变化后实时更新。">
        <a-alert v-if="commandState.error" type="error" show-icon :message="commandState.error" />
        <ResultPanel v-else :value="commandState.command" label="iperf3 命令" />
        <div class="command-summary">
          <div v-for="item in summary" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
        </div>
        <div v-if="isClient" class="counterpart-command">
          <span><SwapOutlined /> 对端应运行</span>
          <code>iperf3 -s{{ settings.port === 5201 ? '' : ` -p ${settings.port}` }}</code>
        </div>
        <div class="responsible-note"><ThunderboltOutlined /> 请只在你管理或获得明确授权的网络中执行测试。</div>
      </ToolCard>
    </aside>
  </div>
</template>

<style scoped>
.iperf-layout { display: grid; grid-template-columns: minmax(0, 1fr) 370px; align-items: start; gap: 18px; }
.iperf-main { min-width: 0; }
.iperf-aside { position: sticky; top: 82px; min-width: 0; }
.preset-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.preset-grid button { min-height: 72px; padding: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-subtle); color: var(--text-main); text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease; }
.preset-grid button:hover { border-color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 7%, var(--panel-subtle)); }
.preset-grid strong, .preset-grid span { display: block; }
.preset-grid strong { margin-bottom: 5px; font-size: 13px; }
.preset-grid span { color: var(--text-muted); font-size: 11px; line-height: 1.45; }
.option-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.iperf-aside :deep(.result-panel) { margin-top: 0; }
.iperf-aside :deep(.result-panel pre) { min-height: 130px; }
.command-summary { margin-top: 14px; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; }
.command-summary > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 11px; border-bottom: 1px solid var(--line); font-size: 11px; }
.command-summary > div:last-child { border-bottom: 0; }
.command-summary span { color: var(--text-muted); }
.command-summary strong { color: var(--text-main); text-align: right; }
.counterpart-command { margin-top: 14px; padding: 11px; border-radius: 8px; background: var(--panel-subtle); }
.counterpart-command span { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 11px; }
.counterpart-command code { overflow-wrap: anywhere; color: var(--primary-color); font-size: 12px; }
.responsible-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 14px; color: var(--text-muted); font-size: 11px; line-height: 1.6; }
@media (max-width: 1100px) { .iperf-layout { grid-template-columns: 1fr; } .iperf-aside { position: static; grid-row: 1; } }
@media (max-width: 640px) { .preset-grid, .option-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 420px) { .preset-grid, .option-grid { grid-template-columns: 1fr; } }
</style>
