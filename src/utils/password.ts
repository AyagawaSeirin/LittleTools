import { randomInt, shuffleSecure } from './random'

export const passwordCharsets = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
} as const

export type CharsetKey = keyof typeof passwordCharsets

export function generatePassword(length: number, enabled: CharsetKey[], excluded = ''): string {
  const excludedSet = new Set(Array.from(excluded))
  const pools = enabled
    .map((key) => Array.from(passwordCharsets[key]).filter((char) => !excludedSet.has(char)).join(''))
    .filter(Boolean)

  if (!pools.length) throw new Error('至少需要一个可用字符集')
  if (length < pools.length) throw new Error('密码长度不能小于已选字符集数量')

  const all = pools.join('')
  const required = pools.map((pool) => pool[randomInt(0, pool.length - 1)])
  while (required.length < length) required.push(all[randomInt(0, all.length - 1)])
  return shuffleSecure(required).join('')
}

export function estimateEntropy(length: number, poolSize: number): number {
  return Math.max(0, Math.round(length * Math.log2(Math.max(1, poolSize))))
}

export function strengthFromEntropy(entropy: number) {
  if (entropy < 40) return { label: '偏弱', color: '#b14747', percent: 25 }
  if (entropy < 60) return { label: '一般', color: '#ad7629', percent: 50 }
  if (entropy < 80) return { label: '较强', color: '#3f7f66', percent: 75 }
  return { label: '很强', color: '#28705b', percent: 100 }
}
