import { describe, expect, it } from 'vitest'
import { decodeText, encodeText } from '../utils/encoding'
import { cidrRange, formatIPv4, formatIPv6, parseIPv4, parseIPv6 } from '../utils/ip'
import { generatePassword } from '../utils/password'

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
