export type TcpdumpMode = 'capture' | 'read' | 'read-list' | 'list-interfaces' | 'list-datalinks' | 'list-timestamps' | 'compile-filter'
export type TcpdumpPacketFormat = 'summary' | 'ascii' | 'hex' | 'hex-link' | 'hex-ascii' | 'hex-ascii-link'
export type TcpdumpFilterSource = 'builder' | 'custom' | 'file'

export interface TcpdumpOptions {
  mode: TcpdumpMode
  useSudo: boolean
  interface: string
  readFile: string
  fileList: string
  packetCount: number
  skipCount: number
  snaplen: number
  bufferSize: number
  direction: '' | 'in' | 'out' | 'inout'
  monitorMode: boolean
  immediateMode: boolean
  noPromiscuous: boolean
  timestampType: string
  timestampPrecision: 'default' | 'micro' | 'nano'
  datalinkType: string
  dropUser: string
  noChecksum: boolean
  noOptimize: boolean
  packetFormat: TcpdumpPacketFormat
  verbosity: number
  nameResolution: 'default' | 'no-address' | 'numeric'
  timestampDisplay: 'default' | 'none' | 'unix' | 'delta' | 'date' | 'delta-first'
  linkHeader: boolean
  absoluteSequence: boolean
  quiet: boolean
  lineBuffered: boolean
  packetBuffered: boolean
  packetNumber: boolean
  printLengths: boolean
  ipOneline: boolean
  foreignNumeric: boolean
  printSampling: number
  countOnly: boolean
  forceProtocol: string
  writeFile: string
  printWhileWriting: boolean
  rotateSize: string
  rotateSeconds: number
  fileCount: number
  postRotate: '' | 'gzip' | 'bzip2' | 'xz'
  filterSource: TcpdumpFilterSource
  filterFile: string
  protocol: string
  hostDirection: '' | 'src' | 'dst'
  host: string
  excludeHost: boolean
  netDirection: '' | 'src' | 'dst'
  network: string
  portDirection: '' | 'src' | 'dst'
  portMode: 'none' | 'single' | 'range'
  port: number
  portRange: string
  vlanId: number
  tcpFlags: 'none' | 'syn' | 'syn-ack' | 'rst' | 'fin'
  lengthOperator: 'none' | 'greater' | 'less'
  packetLength: number
  customExpression: string
  compileFormat: 'human' | 'c' | 'decimal'
}

export function defaultTcpdumpOptions(): TcpdumpOptions {
  return {
    mode: 'capture',
    useSudo: true,
    interface: 'any',
    readFile: 'capture.pcap',
    fileList: 'pcap-files.txt',
    packetCount: 0,
    skipCount: 0,
    snaplen: 0,
    bufferSize: 0,
    direction: '',
    monitorMode: false,
    immediateMode: false,
    noPromiscuous: false,
    timestampType: '',
    timestampPrecision: 'default',
    datalinkType: '',
    dropUser: '',
    noChecksum: false,
    noOptimize: false,
    packetFormat: 'summary',
    verbosity: 0,
    nameResolution: 'default',
    timestampDisplay: 'default',
    linkHeader: false,
    absoluteSequence: false,
    quiet: false,
    lineBuffered: false,
    packetBuffered: false,
    packetNumber: false,
    printLengths: false,
    ipOneline: false,
    foreignNumeric: false,
    printSampling: 0,
    countOnly: false,
    forceProtocol: '',
    writeFile: '',
    printWhileWriting: false,
    rotateSize: '',
    rotateSeconds: 0,
    fileCount: 0,
    postRotate: '',
    filterSource: 'builder',
    filterFile: '',
    protocol: '',
    hostDirection: '',
    host: '',
    excludeHost: false,
    netDirection: '',
    network: '',
    portDirection: '',
    portMode: 'none',
    port: 443,
    portRange: '8000-8100',
    vlanId: -1,
    tcpFlags: 'none',
    lengthOperator: 'none',
    packetLength: 0,
    customExpression: '',
    compileFormat: 'human',
  }
}

function shellArg(value: string) {
  if (!value || /[\0\r\n]/.test(value)) throw new Error('参数不能为空或包含换行符')
  if (/^[a-z\d_./:%+@=-]+$/i.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function integer(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label}必须在 ${min}–${max} 之间`)
  return String(value)
}

function optionalInteger(value: number, label: string, min: number, max: number) {
  return value ? integer(value, label, min, max) : ''
}

function safeEndpoint(value: string, label: string, allowCidr = false) {
  const normalized = value.trim()
  const pattern = allowCidr ? /^[a-z\d._:%/-]+$/i : /^[a-z\d._:%-]+$/i
  if (!pattern.test(normalized)) throw new Error(`${label}格式无效`)
  return normalized
}

function safeToken(value: string, label: string) {
  const normalized = value.trim()
  if (!/^[a-z\d_.-]+$/i.test(normalized)) throw new Error(`${label}格式无效`)
  return normalized
}

export function buildVisualFilter(options: TcpdumpOptions) {
  const filters: string[] = []
  if (options.protocol.trim()) filters.push(safeToken(options.protocol, '协议'))
  if (options.host.trim()) {
    const direction = options.hostDirection ? `${options.hostDirection} ` : ''
    const expression = `${direction}host ${safeEndpoint(options.host, '主机')}`
    filters.push(options.excludeHost ? `not (${expression})` : expression)
  }
  if (options.network.trim()) {
    const direction = options.netDirection ? `${options.netDirection} ` : ''
    filters.push(`${direction}net ${safeEndpoint(options.network, '网段', true)}`)
  }
  if (options.portMode === 'single') {
    const direction = options.portDirection ? `${options.portDirection} ` : ''
    filters.push(`${direction}port ${integer(options.port, '端口', 1, 65535)}`)
  }
  if (options.portMode === 'range') {
    const [startRaw, endRaw] = options.portRange.trim().split('-')
    const start = Number(startRaw)
    const end = Number(endRaw)
    if (!startRaw || !endRaw || start > end) throw new Error('端口范围格式应类似 8000-8100')
    const direction = options.portDirection ? `${options.portDirection} ` : ''
    filters.push(`${direction}portrange ${integer(start, '起始端口', 1, 65535)}-${integer(end, '结束端口', 1, 65535)}`)
  }
  if (options.vlanId >= 0) filters.push(`vlan ${integer(options.vlanId, 'VLAN ID', 0, 4095)}`)
  const tcpFlagFilters = {
    none: '',
    syn: 'tcp[tcpflags] & (tcp-syn|tcp-ack) == tcp-syn',
    'syn-ack': 'tcp[tcpflags] & (tcp-syn|tcp-ack) == (tcp-syn|tcp-ack)',
    rst: 'tcp[tcpflags] & tcp-rst != 0',
    fin: 'tcp[tcpflags] & tcp-fin != 0',
  }
  if (options.tcpFlags !== 'none') filters.push(tcpFlagFilters[options.tcpFlags])
  if (options.lengthOperator !== 'none') {
    const operator = options.lengthOperator === 'greater' ? 'greater' : 'less'
    filters.push(`${operator} ${integer(options.packetLength, '报文长度', 1, 65535)}`)
  }
  return filters.join(' and ')
}

function buildFilter(options: TcpdumpOptions) {
  if (options.filterSource === 'file') return ''
  if (options.filterSource === 'custom') {
    const expression = options.customExpression.trim()
    if (!expression) return ''
    if (/[\0\r\n]/.test(expression)) throw new Error('BPF 表达式不能包含换行符')
    return expression
  }
  return buildVisualFilter(options)
}

export function buildTcpdumpCommand(options: TcpdumpOptions) {
  const args = [...(options.useSudo ? ['sudo'] : []), 'tcpdump']

  if (options.mode === 'list-interfaces') return [...args, '-D'].join(' ')

  const captureLike = ['capture', 'list-datalinks', 'list-timestamps', 'compile-filter'].includes(options.mode)
  if (captureLike && options.interface.trim()) args.push('-i', shellArg(options.interface.trim()))
  if (options.mode === 'list-datalinks') {
    if (options.monitorMode) args.push('-I')
    args.push('-L')
    return args.join(' ')
  }
  if (options.mode === 'list-timestamps') return [...args, '-J'].join(' ')
  if (options.mode === 'read') args.push('-r', shellArg(options.readFile.trim()))
  if (options.mode === 'read-list') args.push('-V', shellArg(options.fileList.trim()))

  if (options.mode === 'compile-filter') {
    args.push(({ human: '-d', c: '-dd', decimal: '-ddd' })[options.compileFormat])
  }
  if (options.packetCount) args.push('-c', optionalInteger(options.packetCount, '报文数量', 1, 1000000000))
  if (options.skipCount) args.push('--skip', optionalInteger(options.skipCount, '跳过数量', 1, 1000000000))
  if (options.snaplen) args.push('-s', optionalInteger(options.snaplen, '抓取长度', 1, 262144))
  if (options.bufferSize && captureLike) args.push('-B', optionalInteger(options.bufferSize, '缓冲区大小', 1, 1048576))
  if (options.direction && options.mode === 'capture') args.push('-Q', options.direction)
  if (options.monitorMode && options.mode === 'capture') args.push('-I')
  if (options.immediateMode && options.mode === 'capture') args.push('--immediate-mode')
  if (options.noPromiscuous && options.mode === 'capture') args.push('-p')
  if (options.timestampType.trim() && options.mode === 'capture') args.push('-j', safeToken(options.timestampType, '时间戳类型'))
  if (options.timestampPrecision !== 'default') args.push(`--${options.timestampPrecision}`)
  if (options.datalinkType.trim()) args.push('-y', safeToken(options.datalinkType, '链路类型'))
  if (options.dropUser.trim()) args.push('-Z', safeToken(options.dropUser, '降权用户'))
  if (options.noChecksum) args.push('-K')
  if (options.noOptimize) args.push('-O')
  if (options.nameResolution === 'no-address') args.push('-n')
  if (options.nameResolution === 'numeric') args.push('-nn')
  const timestampFlags = { default: '', none: '-t', unix: '-tt', delta: '-ttt', date: '-tttt', 'delta-first': '-ttttt' }
  if (timestampFlags[options.timestampDisplay]) args.push(timestampFlags[options.timestampDisplay])
  if (options.verbosity > 0) args.push(`-${'v'.repeat(Math.min(3, options.verbosity))}`)
  const formatFlags = { summary: '', ascii: '-A', hex: '-x', 'hex-link': '-xx', 'hex-ascii': '-X', 'hex-ascii-link': '-XX' }
  if (formatFlags[options.packetFormat]) args.push(formatFlags[options.packetFormat])
  if (options.linkHeader) args.push('-e')
  if (options.absoluteSequence) args.push('-S')
  if (options.quiet) args.push('-q')
  if (options.lineBuffered) args.push('-l')
  if (options.packetBuffered) args.push('-U')
  if (options.packetNumber) args.push('--number')
  if (options.printLengths) args.push('--lengths')
  if (options.ipOneline) args.push('-g')
  if (options.foreignNumeric) args.push('-f')
  if (options.printSampling) args.push(`--print-sampling=${integer(options.printSampling, '打印采样间隔', 1, 1000000000)}`)
  if (options.countOnly && (options.mode === 'read' || options.mode === 'read-list')) args.push('--count')
  if (options.forceProtocol.trim()) args.push('-T', safeToken(options.forceProtocol, '强制解析协议'))

  if (options.writeFile.trim() && options.mode !== 'compile-filter') {
    args.push('-w', shellArg(options.writeFile.trim()))
    if (options.printWhileWriting) args.push('--print')
    if (options.rotateSize.trim()) {
      if (!/^\d+(?:[kmgt])?$/i.test(options.rotateSize.trim())) throw new Error('轮转大小格式应类似 100M 或 1G')
      args.push('-C', options.rotateSize.trim())
    }
    if (options.rotateSeconds) args.push('-G', optionalInteger(options.rotateSeconds, '轮转间隔', 1, 31536000))
    if (options.fileCount) args.push('-W', optionalInteger(options.fileCount, '保留文件数', 1, 1000000))
    if (options.postRotate) args.push('-z', options.postRotate)
  }

  if (options.filterSource === 'file') {
    if (!options.filterFile.trim()) throw new Error('请输入 BPF 过滤器文件路径')
    args.push('-F', shellArg(options.filterFile.trim()))
  } else {
    const filter = buildFilter(options)
    if (filter) args.push('--', shellArg(filter))
  }
  return args.join(' ')
}
