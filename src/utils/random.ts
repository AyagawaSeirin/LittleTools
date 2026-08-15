export function randomBigInt(maxExclusive: bigint): bigint {
  if (maxExclusive <= 0n) throw new Error('随机数上限必须大于 0')
  const bitLength = maxExclusive.toString(2).length
  const byteLength = Math.ceil(bitLength / 8)
  const extraBits = byteLength * 8 - bitLength

  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
    if (extraBits > 0) bytes[0] &= 0xff >>> extraBits
    let value = 0n
    for (const byte of bytes) value = (value << 8n) | BigInt(byte)
    if (value < maxExclusive) return value
  }
}

export function randomInt(min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new Error('随机数范围无效')
  }
  return min + Number(randomBigInt(BigInt(max - min + 1)))
}

export function shuffleSecure<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
