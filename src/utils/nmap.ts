export type NmapScanType = 'syn' | 'connect' | 'udp' | 'tcp-udp' | 'ping'
export type NmapPortMode = 'default' | 'fast' | 'top' | 'custom' | 'all'
export type NmapScriptPreset = 'none' | 'default' | 'safe' | 'discovery' | 'web' | 'tls'
export type NmapDnsMode = 'default' | 'none' | 'always'
export type NmapOutputMode = 'none' | 'normal' | 'xml' | 'all'

export interface NmapCommandOptions {
  target: string
  useSudo: boolean
  scanType: NmapScanType
  portMode: NmapPortMode
  customPorts: string
  topPorts: number
  serviceVersion: boolean
  osDetection: boolean
  scriptPreset: NmapScriptPreset
  noPing: boolean
  onlyOpen: boolean
  traceroute: boolean
  showReason: boolean
  ipv6: boolean
  verbose: boolean
  timing: number
  dnsMode: NmapDnsMode
  outputMode: NmapOutputMode
  outputName: string
}

const scanFlags: Record<NmapScanType, string[]> = {
  syn: ['-sS'],
  connect: ['-sT'],
  udp: ['-sU'],
  'tcp-udp': ['-sS', '-sU'],
  ping: ['-sn'],
}

const scriptFlags: Record<NmapScriptPreset, string[]> = {
  none: [],
  default: ['-sC'],
  safe: ['--script', 'safe'],
  discovery: ['--script', 'discovery'],
  web: ['--script', 'http-title,http-headers'],
  tls: ['--script', 'ssl-cert,ssl-enum-ciphers'],
}

function validateTarget(target: string) {
  if (!target) throw new Error('请输入扫描目标')
  if (target.startsWith('-') || !/^[a-z\d._:/-]+$/i.test(target)) {
    throw new Error('目标仅支持主机名、IP、CIDR 或 Nmap 地址范围格式')
  }
}

function normalizePorts(value: string) {
  const ports = value.replace(/\s+/g, '')
  if (!ports || !/^\d{1,5}(?:-\d{1,5})?(?:,\d{1,5}(?:-\d{1,5})?)*$/.test(ports)) {
    throw new Error('端口格式应类似 22,80,443 或 1-1024')
  }
  for (const group of ports.split(',')) {
    const [start, end = start] = group.split('-').map(Number)
    if (start < 1 || end > 65535 || start > end) throw new Error('端口必须在 1–65535 之间')
  }
  return ports
}

function validateOutputName(value: string) {
  if (!value || value.startsWith('-') || value.includes('..') || !/^[a-z\d_./-]+$/i.test(value)) {
    throw new Error('输出文件名仅支持字母、数字、点、斜杠、短横线和下划线')
  }
}

export function buildNmapCommand(options: NmapCommandOptions) {
  const target = options.target.trim()
  validateTarget(target)

  const args: string[] = [...(options.useSudo ? ['sudo'] : []), 'nmap', ...scanFlags[options.scanType]]
  const isPingScan = options.scanType === 'ping'

  if (options.ipv6) args.push('-6')

  if (!isPingScan) {
    if (options.portMode === 'fast') args.push('-F')
    if (options.portMode === 'top') {
      if (!Number.isInteger(options.topPorts) || options.topPorts < 1 || options.topPorts > 65535) {
        throw new Error('热门端口数量必须在 1–65535 之间')
      }
      args.push('--top-ports', String(options.topPorts))
    }
    if (options.portMode === 'custom') args.push('-p', normalizePorts(options.customPorts))
    if (options.portMode === 'all') args.push('-p-')

    if (options.serviceVersion) args.push('-sV')
    if (options.osDetection) args.push('-O')
    args.push(...scriptFlags[options.scriptPreset])
    if (options.onlyOpen) args.push('--open')
  }

  if (options.noPing && !isPingScan) args.push('-Pn')
  if (options.traceroute) args.push('--traceroute')
  if (options.showReason) args.push('--reason')
  args.push(`-T${Math.min(5, Math.max(0, Math.round(options.timing)))}`)
  if (options.dnsMode === 'none') args.push('-n')
  if (options.dnsMode === 'always') args.push('-R')
  if (options.verbose) args.push('-v')

  if (options.outputMode !== 'none') {
    const name = options.outputName.trim()
    validateOutputName(name)
    const outputFlag = { normal: '-oN', xml: '-oX', all: '-oA' }[options.outputMode]
    args.push(outputFlag, name)
  }

  args.push(target)
  return args.join(' ')
}
