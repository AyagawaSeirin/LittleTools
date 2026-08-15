function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/\s/g, '')
  const binary = atob(normalized)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export const encodingOptions = [
  { value: 'base64', label: 'Base64' },
  { value: 'url', label: 'URL 编码' },
  { value: 'html', label: 'HTML 实体' },
  { value: 'unicode', label: 'Unicode 转义' },
  { value: 'hex', label: 'Hex（UTF-8）' },
  { value: 'binary', label: '二进制（UTF-8）' },
] as const

export type EncodingType = typeof encodingOptions[number]['value']

export function encodeText(value: string, type: EncodingType): string {
  const bytes = encoder.encode(value)
  switch (type) {
    case 'base64': return bytesToBase64(bytes)
    case 'url': return encodeURIComponent(value)
    case 'html': return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
    case 'unicode': return Array.from(value).map((char) => `\\u{${char.codePointAt(0)!.toString(16)}}`).join('')
    case 'hex': return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
    case 'binary': return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join(' ')
  }
}

export function decodeText(value: string, type: EncodingType): string {
  switch (type) {
    case 'base64': return decoder.decode(base64ToBytes(value))
    case 'url': return decodeURIComponent(value)
    case 'html': {
      const namedEntities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
      return value
      .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
      .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity: string) => namedEntities[entity]!)
      .replace(/&#39;/g, "'")
    }
    case 'unicode': return value
      .replace(/\\u\{([\da-f]+)\}/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/\\u([\da-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    case 'hex': {
      const clean = value.replace(/(?:0x|[\s,:-])/gi, '')
      if (!/^[\da-f]*$/i.test(clean) || clean.length % 2 !== 0) throw new Error('Hex 内容必须由完整字节组成')
      return decoder.decode(Uint8Array.from(clean.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16)))
    }
    case 'binary': {
      const clean = value.replace(/[\s,]/g, '')
      if (!/^[01]*$/.test(clean) || clean.length % 8 !== 0) throw new Error('二进制内容必须由完整的 8 位字节组成')
      return decoder.decode(Uint8Array.from(clean.match(/.{8}/g) || [], (byte) => Number.parseInt(byte, 2)))
    }
  }
}
