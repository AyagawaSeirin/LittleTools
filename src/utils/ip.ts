import { randomBigInt } from './random'

export const IPV4_MAX = (1n << 32n) - 1n
export const IPV6_MAX = (1n << 128n) - 1n

export function parseIPv4(input: string): bigint {
  const parts = input.trim().split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    throw new Error('IPv4 地址格式无效')
  }
  return parts.reduce((result, part) => {
    const value = Number(part)
    if (value < 0 || value > 255) throw new Error('IPv4 地址格式无效')
    return (result << 8n) | BigInt(value)
  }, 0n)
}

export function formatIPv4(value: bigint): string {
  if (value < 0n || value > IPV4_MAX) throw new Error('IPv4 数值超出范围')
  return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 255n)).join('.')
}

export function parseIPv6(input: string): bigint {
  let address = input.trim().toLowerCase().split('%')[0]
  if (!address) throw new Error('IPv6 地址不能为空')

  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':')
    const v4 = parseIPv4(address.slice(lastColon + 1))
    address = `${address.slice(0, lastColon)}:${((v4 >> 16n) & 0xffffn).toString(16)}:${(v4 & 0xffffn).toString(16)}`
  }

  if ((address.match(/::/g) || []).length > 1) throw new Error('IPv6 地址格式无效')
  const hasCompression = address.includes('::')
  const [leftRaw, rightRaw = ''] = address.split('::')
  const left = leftRaw ? leftRaw.split(':') : []
  const right = rightRaw ? rightRaw.split(':') : []
  const missing = 8 - left.length - right.length
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) throw new Error('IPv6 地址格式无效')
  const groups = [...left, ...Array(hasCompression ? missing : 0).fill('0'), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    throw new Error('IPv6 地址格式无效')
  }
  return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group}`), 0n)
}

export function formatIPv6Expanded(value: bigint): string {
  if (value < 0n || value > IPV6_MAX) throw new Error('IPv6 数值超出范围')
  return Array.from({ length: 8 }, (_, index) => {
    const shift = BigInt((7 - index) * 16)
    return ((value >> shift) & 0xffffn).toString(16).padStart(4, '0')
  }).join(':')
}

export function formatIPv6(value: bigint): string {
  const groups = formatIPv6Expanded(value).split(':').map((group) => group.replace(/^0+(?=.)/, ''))
  let bestStart = -1
  let bestLength = 0
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== '0') { i += 1; continue }
    let end = i
    while (end < groups.length && groups[end] === '0') end += 1
    if (end - i > bestLength) { bestStart = i; bestLength = end - i }
    i = end
  }
  if (bestLength < 2) return groups.join(':')
  const left = groups.slice(0, bestStart).join(':')
  const right = groups.slice(bestStart + bestLength).join(':')
  return `${left}::${right}`
}

export function cidrRange(address: bigint, prefix: number, bits: 32 | 128) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) throw new Error('CIDR 前缀无效')
  const max = (1n << BigInt(bits)) - 1n
  const hostBits = BigInt(bits - prefix)
  const mask = prefix === 0 ? 0n : (max << hostBits) & max
  const start = address & mask
  const end = start | (max ^ mask)
  return { start, end, mask, total: 1n << hostBits }
}

export function randomInRange(start: bigint, end: bigint): bigint {
  if (start > end) throw new Error('起始地址不能大于结束地址')
  return start + randomBigInt(end - start + 1n)
}

export function isPublicIPv4(value: bigint): boolean {
  const ranges: Array<[string, number]> = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 4], ['240.0.0.0', 4],
  ]
  return !ranges.some(([network, prefix]) => {
    const range = cidrRange(parseIPv4(network), prefix, 32)
    return value >= range.start && value <= range.end
  })
}

export function ipv6Ptr(value: bigint): string {
  return `${value.toString(16).padStart(32, '0').split('').reverse().join('.')}.ip6.arpa`
}

export function ipv4Mask(prefix: number): string {
  return formatIPv4(cidrRange(0n, prefix, 32).mask)
}

export function parseIpWithOptionalCidr(input: string): { version: 4 | 6; value: bigint; prefix: number } {
  const [address, prefixRaw] = input.trim().split('/')
  const version = address.includes(':') ? 6 : 4
  const bits = version === 4 ? 32 : 128
  const prefix = prefixRaw === undefined ? bits : Number(prefixRaw)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) throw new Error(`前缀应为 0–${bits}`)
  return { version, value: version === 4 ? parseIPv4(address) : parseIPv6(address), prefix }
}
