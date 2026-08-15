import { describe, expect, it } from 'vitest'
import { decodeText, encodeText } from '../utils/encoding'
import { cidrRange, formatIPv4, formatIPv6, parseIPv4, parseIPv6 } from '../utils/ip'
import { generatePassword } from '../utils/password'
import { buildNmapCommand, type NmapCommandOptions } from '../utils/nmap'

describe('IP utilities', () => {
  it('round trips IPv4 addresses', () => {
    expect(formatIPv4(parseIPv4('192.168.1.42'))).toBe('192.168.1.42')
  })

  it('calculates IPv4 CIDR boundaries', () => {
    const range = cidrRange(parseIPv4('192.168.1.42'), 24, 32)
    expect(formatIPv4(range.start)).toBe('192.168.1.0')
    expect(formatIPv4(range.end)).toBe('192.168.1.255')
    expect(range.total).toBe(256n)
  })

  it('parses and compresses IPv6 addresses', () => {
    const value = parseIPv6('2001:0db8:0000:0000:0000:ff00:0042:8329')
    expect(formatIPv6(value)).toBe('2001:db8::ff00:42:8329')
    expect(parseIPv6('::1')).toBe(1n)
  })
})

describe('encoding utilities', () => {
  it.each(['base64', 'url', 'html', 'unicode', 'hex', 'binary'] as const)('round trips %s with UTF-8', (type) => {
    const original = '你好, LittleTools! 🧰 & <ok>'
    expect(decodeText(encodeText(original, type), type)).toBe(original)
  })
})

describe('password generation', () => {
  it('uses the requested length and every enabled character class', () => {
    const password = generatePassword(20, ['lowercase', 'uppercase', 'numbers', 'symbols'])
    expect(password).toHaveLength(20)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[^a-zA-Z0-9]/)
  })
})

const nmapDefaults: NmapCommandOptions = {
  target: 'scanme.nmap.org',
  useSudo: false,
  scanType: 'syn',
  portMode: 'default',
  customPorts: '22,80,443',
  topPorts: 100,
  serviceVersion: false,
  osDetection: false,
  scriptPreset: 'none',
  noPing: false,
  onlyOpen: false,
  traceroute: false,
  showReason: false,
  ipv6: false,
  verbose: false,
  timing: 3,
  dnsMode: 'default',
  outputMode: 'none',
  outputName: 'nmap-scan',
}

describe('Nmap command generation', () => {
  it('builds a simple default SYN scan', () => {
    expect(buildNmapCommand(nmapDefaults)).toBe('nmap -sS -T3 scanme.nmap.org')
  })

  it('combines detection, ports, scripts and output', () => {
    expect(buildNmapCommand({
      ...nmapDefaults,
      target: '192.168.1.0/24',
      scanType: 'tcp-udp',
      portMode: 'custom',
      customPorts: '53,80,443,8000-8100',
      serviceVersion: true,
      osDetection: true,
      scriptPreset: 'web',
      noPing: true,
      onlyOpen: true,
      timing: 4,
      outputMode: 'all',
      outputName: 'reports/lan-scan',
    })).toBe('nmap -sS -sU -p 53,80,443,8000-8100 -sV -O --script http-title,http-headers --open -Pn -T4 -oA reports/lan-scan 192.168.1.0/24')
  })

  it('rejects shell syntax in targets', () => {
    expect(() => buildNmapCommand({ ...nmapDefaults, target: 'example.com;whoami' })).toThrow('目标仅支持')
  })

  it('rejects invalid port ranges', () => {
    expect(() => buildNmapCommand({ ...nmapDefaults, portMode: 'custom', customPorts: '443-80' })).toThrow('端口必须')
  })
})
