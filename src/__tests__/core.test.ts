import { describe, expect, it } from 'vitest'
import { decodeText, encodeText } from '../utils/encoding'
import { cidrRange, formatIPv4, formatIPv6, parseIPv4, parseIPv6 } from '../utils/ip'
import { generatePassword } from '../utils/password'
import { buildNmapCommand, type NmapCommandOptions } from '../utils/nmap'
import { buildIperf3Command, defaultIperf3Options } from '../utils/iperf3'
import { buildTcpdumpCommand, defaultTcpdumpOptions } from '../utils/tcpdump'

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

describe('iperf3 command generation', () => {
  it('builds the default client command', () => {
    expect(buildIperf3Command(defaultIperf3Options())).toBe('iperf3 -c iperf3.example.com -t 10')
  })

  it('builds a bidirectional parallel UDP test', () => {
    expect(buildIperf3Command({
      ...defaultIperf3Options(),
      host: '10.0.0.20',
      protocol: 'udp',
      direction: 'bidir',
      bitrate: '100M',
      burst: 20,
      parallel: 4,
      length: '1400',
      udpCounters64: true,
      dontFragment: true,
      outputMode: 'json-stream',
      jsonStreamFull: true,
    })).toBe('iperf3 -c 10.0.0.20 -u --json-stream --json-stream-full-output -t 10 -P 4 --bidir -b 100M/20 -l 1400 --udp-counters-64bit --dont-fragment')
  })

  it('builds a one-off authenticated server', () => {
    expect(buildIperf3Command({
      ...defaultIperf3Options(),
      mode: 'server',
      port: 5002,
      serverOneOff: true,
      serverIdleTimeout: 60,
      serverMaxDuration: 300,
      serverBitrateLimit: '1G/5',
      rsaPrivateKey: '/etc/iperf/private.pem',
      authorizedUsers: '/etc/iperf/users.csv',
      logfile: '/var/log/iperf3.log',
    })).toBe('iperf3 -s -p 5002 --logfile /var/log/iperf3.log -1 --idle-timeout 60 --server-max-duration 300 --server-bitrate-limit 1G/5 --rsa-private-key-path /etc/iperf/private.pem --authorized-users-path /etc/iperf/users.csv')
  })

  it('quotes labels safely and rejects invalid hosts', () => {
    expect(buildIperf3Command({ ...defaultIperf3Options(), title: 'Office uplink' })).toContain("-T 'Office uplink'")
    expect(() => buildIperf3Command({ ...defaultIperf3Options(), host: 'server;whoami' })).toThrow('服务端地址格式无效')
  })
})

describe('tcpdump command generation', () => {
  it('builds the default live capture command', () => {
    expect(buildTcpdumpCommand(defaultTcpdumpOptions())).toBe('sudo tcpdump -i any')
  })

  it('builds a visual HTTPS capture filter', () => {
    expect(buildTcpdumpCommand({
      ...defaultTcpdumpOptions(),
      interface: 'eth0',
      packetCount: 100,
      nameResolution: 'numeric',
      verbosity: 2,
      protocol: 'tcp',
      hostDirection: 'src',
      host: '10.0.0.8',
      portMode: 'single',
      port: 443,
    })).toBe("sudo tcpdump -i eth0 -c 100 -nn -vv -- 'tcp and src host 10.0.0.8 and port 443'")
  })

  it('builds a rotating pcap capture', () => {
    expect(buildTcpdumpCommand({
      ...defaultTcpdumpOptions(),
      writeFile: 'captures/net-%Y%m%d-%H%M.pcap',
      rotateSize: '100M',
      rotateSeconds: 3600,
      fileCount: 24,
      postRotate: 'gzip',
      protocol: 'udp',
      portMode: 'single',
      port: 53,
    })).toBe("sudo tcpdump -i any -w captures/net-%Y%m%d-%H%M.pcap -C 100M -G 3600 -W 24 -z gzip -- 'udp and port 53'")
  })

  it('supports read mode and interface listing', () => {
    expect(buildTcpdumpCommand({ ...defaultTcpdumpOptions(), mode: 'read', useSudo: false, readFile: 'capture.pcap', countOnly: true })).toBe('tcpdump -r capture.pcap --count')
    expect(buildTcpdumpCommand({ ...defaultTcpdumpOptions(), mode: 'list-interfaces', useSudo: false })).toBe('tcpdump -D')
  })

  it('rejects unsafe visual endpoints and multiline filters', () => {
    expect(() => buildTcpdumpCommand({ ...defaultTcpdumpOptions(), host: '10.0.0.1;id' })).toThrow('主机格式无效')
    expect(() => buildTcpdumpCommand({ ...defaultTcpdumpOptions(), filterSource: 'custom', customExpression: 'tcp\nport 80' })).toThrow('不能包含换行符')
  })
})
