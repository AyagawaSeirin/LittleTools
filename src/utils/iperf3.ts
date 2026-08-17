export type Iperf3Mode = 'client' | 'server'
export type Iperf3Protocol = 'tcp' | 'udp' | 'sctp'
export type Iperf3IpVersion = 'auto' | '4' | '6'
export type Iperf3Direction = 'forward' | 'reverse' | 'bidir'
export type Iperf3LimitMode = 'time' | 'bytes' | 'blocks'
export type Iperf3OutputMode = 'human' | 'json' | 'json-stream'

export interface Iperf3Options {
  mode: Iperf3Mode
  host: string
  port: number
  protocol: Iperf3Protocol
  ipVersion: Iperf3IpVersion
  bindAddress: string
  bindDevice: string
  affinity: string
  pidFile: string
  filePath: string
  mptcp: boolean
  reportFormat: string
  interval: number
  verbose: boolean
  debug: boolean
  outputMode: Iperf3OutputMode
  jsonStreamFull: boolean
  logfile: string
  forceFlush: boolean
  timestamps: boolean
  timestampFormat: string
  rcvTimeout: number
  sndTimeout: number
  usePkcs1Padding: boolean
  serverDaemon: boolean
  serverOneOff: boolean
  serverIdleTimeout: number
  serverMaxDuration: number
  serverBitrateLimit: string
  rsaPrivateKey: string
  authorizedUsers: string
  timeSkewThreshold: number
  connectTimeout: number
  bitrate: string
  burst: number
  pacingTimer: number
  fqRate: string
  limitMode: Iperf3LimitMode
  duration: number
  bytes: string
  blocks: string
  length: string
  clientPort: number
  parallel: number
  direction: Iperf3Direction
  window: string
  mss: number
  noDelay: boolean
  tos: string
  dscp: string
  flowLabel: string
  xbind: string
  nstreams: number
  zeroCopy: boolean
  skipRxCopy: boolean
  omit: number
  title: string
  extraData: string
  congestion: string
  getServerOutput: boolean
  udpCounters64: boolean
  repeatingPayload: boolean
  dontFragment: boolean
  username: string
  rsaPublicKey: string
}

export function defaultIperf3Options(): Iperf3Options {
  return {
    mode: 'client',
    host: 'iperf3.example.com',
    port: 5201,
    protocol: 'tcp',
    ipVersion: 'auto',
    bindAddress: '',
    bindDevice: '',
    affinity: '',
    pidFile: '',
    filePath: '',
    mptcp: false,
    reportFormat: '',
    interval: 1,
    verbose: false,
    debug: false,
    outputMode: 'human',
    jsonStreamFull: false,
    logfile: '',
    forceFlush: false,
    timestamps: false,
    timestampFormat: '',
    rcvTimeout: 0,
    sndTimeout: 0,
    usePkcs1Padding: false,
    serverDaemon: false,
    serverOneOff: false,
    serverIdleTimeout: 0,
    serverMaxDuration: 0,
    serverBitrateLimit: '',
    rsaPrivateKey: '',
    authorizedUsers: '',
    timeSkewThreshold: 0,
    connectTimeout: 0,
    bitrate: '',
    burst: 0,
    pacingTimer: 0,
    fqRate: '',
    limitMode: 'time',
    duration: 10,
    bytes: '100M',
    blocks: '1000',
    length: '',
    clientPort: 0,
    parallel: 1,
    direction: 'forward',
    window: '',
    mss: 0,
    noDelay: false,
    tos: '',
    dscp: '',
    flowLabel: '',
    xbind: '',
    nstreams: 0,
    zeroCopy: false,
    skipRxCopy: false,
    omit: 0,
    title: '',
    extraData: '',
    congestion: '',
    getServerOutput: false,
    udpCounters64: false,
    repeatingPayload: false,
    dontFragment: false,
    username: '',
    rsaPublicKey: '',
  }
}

function shellArg(value: string) {
  if (!value || /[\0\r\n]/.test(value)) throw new Error('参数内容不能为空或包含换行符')
  if (/^[a-z\d_./:%+@=-]+$/i.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function validateHost(value: string) {
  const host = value.trim()
  if (!host) throw new Error('请输入 iperf3 服务端地址')
  if (!/^[a-z\d._:%-]+$/i.test(host)) throw new Error('服务端地址格式无效')
  return host
}

function integer(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label}必须在 ${min}–${max} 之间`)
  return String(value)
}

function optionalInteger(value: number, label: string, min: number, max: number) {
  if (!value) return ''
  return integer(value, label, min, max)
}

function sizeValue(value: string, label: string, allowZero = false) {
  const normalized = value.trim()
  const pattern = allowZero ? /^(?:0|\d+(?:\.\d+)?[kmgt]?)$/i : /^\d+(?:\.\d+)?[kmgt]?$/i
  if (!pattern.test(normalized)) throw new Error(`${label}格式应类似 100M、1G 或 64K`)
  return normalized
}

function rateValue(value: string, label: string, allowInterval = false) {
  const normalized = value.trim()
  const pattern = allowInterval
    ? /^\d+(?:\.\d+)?[kmgt]?(?:\/\d+)?$/i
    : /^\d+(?:\.\d+)?[kmgt]?$/i
  if (!pattern.test(normalized)) throw new Error(`${label}格式应类似 100M 或 1G${allowInterval ? '/5' : ''}`)
  return normalized
}

function safeToken(value: string, label: string) {
  const normalized = value.trim()
  if (!/^[a-z\d_.-]+$/i.test(normalized)) throw new Error(`${label}格式无效`)
  return normalized
}

function pushCommon(args: string[], options: Iperf3Options) {
  if (options.port !== 5201) args.push('-p', integer(options.port, '端口', 1, 65535))
  if (options.ipVersion === '4') args.push('-4')
  if (options.ipVersion === '6') args.push('-6')
  if (options.bindAddress.trim()) args.push('-B', shellArg(options.bindAddress.trim()))
  if (options.bindDevice.trim()) args.push('--bind-dev', shellArg(options.bindDevice.trim()))
  if (options.affinity.trim()) {
    if (!/^\d+(?:\/\d+(?:,\d+)?)?$/.test(options.affinity.trim())) throw new Error('CPU 亲和性格式应类似 2 或 2/3')
    args.push('-A', options.affinity.trim())
  }
  if (options.pidFile.trim()) args.push('-I', shellArg(options.pidFile.trim()))
  if (options.reportFormat) args.push('-f', safeToken(options.reportFormat, '报告单位'))
  if (options.interval !== 1) args.push('-i', String(Math.max(0, options.interval)))
  if (options.rcvTimeout) args.push('--rcv-timeout', optionalInteger(options.rcvTimeout, '接收超时', 1, 86400000))
  if (options.sndTimeout) args.push('--snd-timeout', optionalInteger(options.sndTimeout, '发送超时', 1, 86400000))
  if (options.verbose) args.push('-V')
  if (options.debug) args.push('-d')
  if (options.outputMode === 'json') args.push('-J')
  if (options.outputMode === 'json-stream') {
    args.push('--json-stream')
    if (options.jsonStreamFull) args.push('--json-stream-full-output')
  }
  if (options.logfile.trim()) args.push('--logfile', shellArg(options.logfile.trim()))
  if (options.forceFlush) args.push('--forceflush')
  if (options.timestamps) args.push(options.timestampFormat.trim() ? `--timestamps=${shellArg(options.timestampFormat.trim())}` : '--timestamps')
  if (options.usePkcs1Padding) args.push('--use-pkcs1-padding')
}

export function buildIperf3Command(options: Iperf3Options) {
  const args = ['iperf3']

  if (options.mode === 'server') {
    args.push('-s')
    pushCommon(args, options)
    if (options.serverDaemon) args.push('-D')
    if (options.serverOneOff) args.push('-1')
    if (options.serverIdleTimeout) args.push('--idle-timeout', optionalInteger(options.serverIdleTimeout, '空闲超时', 1, 86400))
    if (options.serverMaxDuration) args.push('--server-max-duration', optionalInteger(options.serverMaxDuration, '最大测试时长', 1, 86400))
    if (options.serverBitrateLimit.trim()) args.push('--server-bitrate-limit', rateValue(options.serverBitrateLimit, '服务端速率限制', true))
    if (options.rsaPrivateKey.trim()) args.push('--rsa-private-key-path', shellArg(options.rsaPrivateKey.trim()))
    if (options.authorizedUsers.trim()) args.push('--authorized-users-path', shellArg(options.authorizedUsers.trim()))
    if (options.timeSkewThreshold) args.push('--time-skew-threshold', optionalInteger(options.timeSkewThreshold, '时间偏差阈值', 1, 86400))
    return args.join(' ')
  }

  args.push('-c', shellArg(validateHost(options.host)))
  if (options.protocol === 'udp') args.push('-u')
  if (options.protocol === 'sctp') args.push('--sctp')
  pushCommon(args, options)

  if (options.connectTimeout) args.push('--connect-timeout', optionalInteger(options.connectTimeout, '连接超时', 1, 3600000))
  if (options.limitMode === 'time') args.push('-t', integer(options.duration, '测试时长', 0, 86400))
  if (options.limitMode === 'bytes') args.push('-n', sizeValue(options.bytes, '传输字节数'))
  if (options.limitMode === 'blocks') args.push('-k', sizeValue(options.blocks, '数据块数量'))
  if (options.omit) args.push('-O', optionalInteger(options.omit, '预热时间', 1, 3600))
  if (options.parallel !== 1) args.push('-P', integer(options.parallel, '并行流数量', 1, 128))
  if (options.direction === 'reverse') args.push('-R')
  if (options.direction === 'bidir') args.push('--bidir')
  if (options.bitrate.trim()) {
    const bitrate = rateValue(options.bitrate, '目标速率', false)
    const burst = options.burst ? `/${integer(options.burst, '突发包数量', 1, 1000000)}` : ''
    args.push('-b', `${bitrate}${burst}`)
  }
  if (options.length.trim()) args.push('-l', sizeValue(options.length, '缓冲区长度'))
  if (options.window.trim()) args.push('-w', sizeValue(options.window, 'Socket 缓冲区'))
  if (options.mss) args.push('-M', optionalInteger(options.mss, 'MSS', 1, 65535))
  if (options.clientPort) args.push('--cport', optionalInteger(options.clientPort, '客户端端口', 1, 65535))
  if (options.noDelay && options.protocol !== 'udp') args.push('-N')
  if (options.pacingTimer) args.push('--pacing-timer', optionalInteger(options.pacingTimer, 'Pacing 定时器', 1, 10000000))
  if (options.fqRate.trim()) args.push('--fq-rate', rateValue(options.fqRate, 'FQ 速率', false))
  if (options.congestion.trim()) args.push('-C', safeToken(options.congestion, '拥塞控制算法'))
  if (options.tos.trim()) {
    if (!/^(?:\d+|0x[\da-f]+)$/i.test(options.tos.trim())) throw new Error('TOS 应为十进制或十六进制数值')
    args.push('-S', options.tos.trim())
  }
  if (options.dscp.trim()) args.push('--dscp', safeToken(options.dscp, 'DSCP'))
  if (options.flowLabel.trim()) {
    if (!/^(?:\d+|0x[\da-f]+)$/i.test(options.flowLabel.trim())) throw new Error('IPv6 Flow Label 格式无效')
    args.push('-L', options.flowLabel.trim())
  }
  if (options.xbind.trim()) {
    for (const address of options.xbind.split(',').map((item) => item.trim()).filter(Boolean)) args.push('-X', shellArg(address))
  }
  if (options.protocol === 'sctp' && options.nstreams) args.push('--nstreams', optionalInteger(options.nstreams, 'SCTP 流数量', 1, 65535))
  if (options.zeroCopy && options.protocol === 'tcp') args.push('-Z')
  if (options.skipRxCopy) args.push('--skip-rx-copy')
  if (options.udpCounters64 && options.protocol === 'udp') args.push('--udp-counters-64bit')
  if (options.repeatingPayload) args.push('--repeating-payload')
  if (options.dontFragment && options.protocol === 'udp' && options.ipVersion !== '6') args.push('--dont-fragment')
  if (options.mptcp && options.protocol === 'tcp') args.push('-m')
  if (options.filePath.trim() && options.protocol !== 'udp') args.push('-F', shellArg(options.filePath.trim()))
  if (options.getServerOutput) args.push('--get-server-output')
  if (options.title.trim()) args.push('-T', shellArg(options.title.trim()))
  if (options.extraData.trim()) args.push('--extra-data', shellArg(options.extraData.trim()))
  if (options.username.trim()) args.push('--username', shellArg(options.username.trim()))
  if (options.rsaPublicKey.trim()) args.push('--rsa-public-key-path', shellArg(options.rsaPublicKey.trim()))

  return args.join(' ')
}
