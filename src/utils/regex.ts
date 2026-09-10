export type RegexEngine = 'javascript' | 'pcre'
export type TestMode = 'full' | 'partial' | 'none' | 'count'
export interface RegexTest { id: string; name: string; text: string; mode: TestMode; count: number }
export interface RegexDocument {
  version: 1
  name: string
  description: string
  author: string
  tags: string
  engine: RegexEngine
  pattern: string
  flags: string
  text: string
  replacement: string
  listTemplate: string
  tests: RegexTest[]
}
export interface RegexMatch {
  from: number
  to: number
  value: string
  groups: (string | null)[]
  namedGroups: Record<string, string | null>
  groupRanges?: ([number, number] | null)[]
}
export interface RegexTestResult { id: string; passed: boolean; count: number; truncated: boolean; error?: string }
export interface RegexResult {
  matches: RegexMatch[]
  truncated: boolean
  replacement: string
  list: string
  tests: RegexTestResult[]
  elapsed: number
  error?: string
  errorOffset?: number
  outputError?: string
}
export const MATCH_LIMIT = 5000
export const OUTPUT_LIMIT = 2_000_000
export const PATTERN_LIMIT = 20_000
export const TEXT_LIMIT = 1_000_000
export const TEST_LIMIT = 200
export const blankResult = (): RegexResult => ({ matches: [], truncated: false, replacement: '', list: '', tests: [], elapsed: 0 })
export const makeId = () => crypto.randomUUID()
export function exampleDocument(): RegexDocument {
  return {
    version: 1, name: '提取邮箱地址', description: '提取邮箱及用户名、域名。用于常见格式的文本提取，不是完整的邮件地址规范校验。', author: '', tags: '邮箱, 分组, 提取',
    engine: 'javascript', pattern: '(?<user>[\\w.+-]+)@(?<domain>[\\w.-]+\\.[A-Za-z]{2,})', flags: 'g',
    text: '在下面编辑文本，匹配结果会实时更新。\n\n联系邮箱：hello@example.com\n技术支持：support@little.tools\n其他地址：alex+work@company.org\n\n这行不会匹配：hello@ / example.com',
    replacement: '[$<user>]', listTemplate: '$&\\n',
    tests: [
      { id: 'example-1', name: '完整邮箱', text: 'hello@example.com', mode: 'full', count: 1 },
      { id: 'example-2', name: '包含邮箱的文本', text: '联系 hello@example.com 获取帮助', mode: 'partial', count: 1 },
      { id: 'example-3', name: '排除缺少域名的地址', text: 'hello@', mode: 'none', count: 0 },
    ],
  }
}
export function emptyDocument(): RegexDocument {
  return { version: 1, name: '未命名表达式', description: '', author: '', tags: '', engine: 'javascript', pattern: '', flags: 'g', text: '', replacement: '', listTemplate: '$&\\n', tests: [] }
}
export const regexFlags = [
  { flag: 'g', name: '全局匹配', description: '查找所有非重叠的匹配；关闭后只返回第一个。', engines: ['javascript', 'pcre'] },
  { flag: 'i', name: '忽略大小写', description: '匹配时忽略字母大小写。', engines: ['javascript', 'pcre'] },
  { flag: 'm', name: '多行模式', description: '^ 和 $ 同时匹配每行的开头与结尾。', engines: ['javascript', 'pcre'] },
  { flag: 's', name: '点匹配换行', description: '. 可以匹配换行符。', engines: ['javascript', 'pcre'] },
  { flag: 'u', name: 'Unicode', description: '按 Unicode 码点匹配；PCRE 同时启用 Unicode 字符属性（PHP /u 语义）。', engines: ['javascript', 'pcre'] },
  { flag: 'v', name: 'Unicode 集合', description: '支持字符集合交集、差集和字符串属性，与 u 互斥；需要较新的浏览器。', engines: ['javascript'] },
  { flag: 'y', name: '粘连匹配', description: '必须从当前位置匹配；初始位置为 0。', engines: ['javascript'] },
  { flag: 'd', name: '分组位置', description: '生成捕获分组的起止位置（本工具始终收集可用的位置）。', engines: ['javascript'] },
  { flag: 'x', name: '扩展模式', description: '忽略表达式中字符集外未转义的空白，并支持 # 注释。', engines: ['pcre'] },
  { flag: 'U', name: '默认非贪婪', description: '反转量词的贪婪性，与 PHP 的 U 修饰符一致。', engines: ['pcre'] },
  { flag: 'A', name: '起点锚定', description: '只从当前搜索起点尝试匹配。', engines: ['pcre'] },
  { flag: 'D', name: '严格末尾', description: '$ 只匹配文本末尾；在 m 模式下不起作用。', engines: ['pcre'] },
  { flag: 'J', name: '重复组名', description: '允许多个捕获分组使用相同名称。', engines: ['pcre'] },
  { flag: 'n', name: '仅命名捕获', description: '普通圆括号不创建捕获分组，命名分组仍然捕获。', engines: ['pcre'] },
]
export function validateFlags(flags: string, engine: RegexEngine) {
  const allowed = regexFlags.filter((f) => f.engines.includes(engine)).map((f) => f.flag)
  if (new Set(flags).size !== flags.length) throw new Error('修饰符不能重复')
  for (const flag of flags) if (!allowed.includes(flag)) throw new Error(`当前引擎不支持修饰符 ${flag}`)
  if (flags.includes('u') && flags.includes('v')) throw new Error('u 与 v 修饰符不能同时启用')
}
export function advanceIndex(text: string, index: number, unicode: boolean) {
  return index + (unicode && (text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1)
}
export function decodeEscapes(text: string) {
  return text.replace(/\\([nrt\\])/g, (_, char: string) => ({ n: '\n', r: '\r', t: '\t', '\\': '\\' }[char]!))
}
// ECMAScript GetSubstitution, shared by Replace and List. PCRE also accepts $0/${name}/\1.
export function expandTemplate(template: string, match: RegexMatch, source: string, engine: RegexEngine) {
  return template.replace(engine === 'pcre' ? /\$(\$|&|`|'|\d{1,2}|<[^>]*>|\{[^}]*\})|\\(\d{1,2})/g : /\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g, (raw, dollar: string | undefined, slash: string | undefined) => {
    const token = dollar ?? slash!
    if (dollar === '$') return '$'
    if (dollar === '&') return match.value
    if (dollar === '`') return source.slice(0, match.from)
    if (dollar === "'") return source.slice(match.to)
    if (token.startsWith('<') || token.startsWith('{')) {
      if (!Object.keys(match.namedGroups).length) return raw
      const name = token.slice(1, -1)
      return Object.prototype.hasOwnProperty.call(match.namedGroups, name) ? match.namedGroups[name] ?? '' : ''
    }
    const number = Number(token)
    if (number === 0 && engine === 'pcre') return match.value
    if (number > 0 && number <= match.groups.length) return match.groups[number - 1] ?? ''
    if (token.length === 2 && Number(token[0]) > 0 && Number(token[0]) <= match.groups.length) return (match.groups[Number(token[0]) - 1] ?? '') + token[1]
    return engine === 'pcre' ? '' : raw
  })
}
export function buildOutputs(doc: RegexDocument, matches: RegexMatch[]) {
  const replacement = decodeEscapes(doc.replacement), listTemplate = decodeEscapes(doc.listTemplate)
  const replaced: string[] = [], listed: string[] = []
  let cursor = 0, size = 0
  for (const match of matches) {
    const before = doc.text.slice(cursor, match.from)
    const item = expandTemplate(replacement, match, doc.text, doc.engine)
    const listItem = expandTemplate(listTemplate, match, doc.text, doc.engine)
    size += before.length + item.length + listItem.length
    if (size > OUTPUT_LIMIT) throw new Error('输出超过 200 万字符，请缩小文本或调整输出模板。')
    replaced.push(before, item)
    listed.push(listItem)
    cursor = match.to
  }
  if (size + doc.text.length - cursor > OUTPUT_LIMIT) throw new Error('输出超过 200 万字符，请缩小文本或调整输出模板。')
  replaced.push(doc.text.slice(cursor))
  return { replacement: replaced.join(''), list: listed.join('') }
}
export function testPassed(test: RegexTest, matches: RegexMatch[], truncated: boolean) {
  if (test.mode === 'none') return matches.length === 0
  if (test.mode === 'full') return matches.some((m) => m.from === 0 && m.to === test.text.length)
  if (test.mode === 'count') return !truncated && matches.length === test.count
  return matches.length > 0
}
export function validateDocument(value: unknown): RegexDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('不是有效的正则文档')
  const v = value as Record<string, unknown>
  if (v.version !== 1 || !['javascript', 'pcre'].includes(String(v.engine))) throw new Error('文档版本或引擎不受支持')
  const limits = { name: 200, description: 10000, author: 200, tags: 1000, pattern: PATTERN_LIMIT, flags: 20, text: TEXT_LIMIT, replacement: 20000, listTemplate: 20000 }
  for (const [key, limit] of Object.entries(limits)) if (typeof v[key] !== 'string' || (v[key] as string).length > limit) throw new Error(`文档字段 ${key} 格式无效或过长`)
  validateFlags(v.flags as string, v.engine as RegexEngine)
  if (!Array.isArray(v.tests) || v.tests.length > TEST_LIMIT) throw new Error('测试集格式无效，最多支持 200 项')
  const ids = new Set<string>()
  let testSize = 0
  const tests = v.tests.map((t: unknown): RegexTest => {
    if (!t || typeof t !== 'object') throw new Error('测试项格式无效')
    const test = t as Record<string, unknown>
    if (typeof test.id !== 'string' || test.id.length > 100 || ids.has(test.id) || typeof test.name !== 'string' || test.name.length > 200 || typeof test.text !== 'string' || test.text.length > TEXT_LIMIT || !['full', 'partial', 'none', 'count'].includes(String(test.mode)) || !Number.isSafeInteger(test.count) || (test.count as number) < 0) throw new Error('测试项格式无效')
    ids.add(test.id)
    testSize += test.text.length
    if (testSize > TEXT_LIMIT) throw new Error('测试集文本总长度不能超过 100 万字符')
    return { id: test.id, name: test.name, text: test.text, mode: test.mode as TestMode, count: test.count as number }
  })
  return { version: 1, engine: v.engine as RegexEngine, ...Object.fromEntries(Object.keys(limits).map((key) => [key, v[key]])), tests } as RegexDocument
}
export function encodeDocument(doc: RegexDocument) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateDocument(doc)))
  if (bytes.length > 48000) throw new Error('内容太长，无法生成便于分享的链接，请导出 JSON 文件。')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeDocument(encoded: string): RegexDocument {
  if (encoded.length > 64000 || !/^[\w-]+$/.test(encoded)) throw new Error('分享链接无效或过长')
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    return validateDocument(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch { throw new Error('分享链接无效或文档损坏') }
}
