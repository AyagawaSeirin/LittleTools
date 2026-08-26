import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser'

export interface JsonIssue {
  code: string
  message: string
  line: number
  column: number
  offset: number
  length: number
  lineText: string
  caret: string
}

export interface JsonStats {
  nodes: number
  objects: number
  arrays: number
  keys: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
  maxDepth: number
}

export interface JsonSearchMatch {
  path: string
  matchedBy: Array<'key' | 'value' | 'path'>
}

export type JsonParseResult =
  | { ok: true; value: unknown; stats: JsonStats }
  | { ok: false; issue: JsonIssue }

const errorMessages: Record<string, string> = {
  InvalidSymbol: '存在无效字符',
  InvalidNumberFormat: '数字格式无效',
  PropertyNameExpected: '此处应为使用双引号包裹的属性名',
  ValueExpected: '此处缺少 JSON 值',
  ColonExpected: '属性名后缺少冒号',
  CommaExpected: '相邻项目之间缺少逗号',
  CloseBraceExpected: '对象缺少右花括号 }',
  CloseBracketExpected: '数组缺少右方括号 ]',
  EndOfFileExpected: 'JSON 根节点结束后仍有多余内容',
  InvalidCommentToken: '标准 JSON 不支持注释',
  UnexpectedEndOfComment: '注释没有正确结束',
  UnexpectedEndOfString: '字符串没有正确结束',
  UnexpectedEndOfNumber: '数字没有正确结束',
  InvalidUnicode: 'Unicode 转义格式无效',
  InvalidEscapeCharacter: '字符串中存在无效转义字符',
  InvalidCharacter: '存在无效字符',
}

function locate(text: string, error: ParseError): JsonIssue {
  const offset = Math.min(Math.max(0, error.offset), text.length)
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  const nextBreak = text.indexOf('\n', offset)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const lineText = text.slice(lineStart, lineEnd).replace(/\t/g, '  ')
  const rawColumnText = text.slice(lineStart, offset).replace(/\t/g, '  ')
  const column = rawColumnText.length + 1
  const code = printParseErrorCode(error.error)
  const markerLength = Math.max(1, Math.min(error.length || 1, Math.max(1, lineText.length - column + 1)))
  return {
    code,
    message: errorMessages[code] || `JSON 语法错误：${code}`,
    line,
    column,
    offset,
    length: Math.max(1, error.length || 1),
    lineText,
    caret: `${' '.repeat(Math.max(0, column - 1))}^${'~'.repeat(Math.max(0, markerLength - 1))}`,
  }
}

function collectStats(value: unknown): JsonStats {
  const stats: JsonStats = { nodes: 0, objects: 0, arrays: 0, keys: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0, maxDepth: 0 }
  function visit(current: unknown, depth: number) {
    stats.nodes += 1
    stats.maxDepth = Math.max(stats.maxDepth, depth)
    if (current === null) { stats.nulls += 1; return }
    if (Array.isArray(current)) {
      stats.arrays += 1
      current.forEach((item) => visit(item, depth + 1))
      return
    }
    if (typeof current === 'object') {
      stats.objects += 1
      const entries = Object.entries(current as Record<string, unknown>)
      stats.keys += entries.length
      entries.forEach(([, item]) => visit(item, depth + 1))
      return
    }
    if (typeof current === 'string') stats.strings += 1
    if (typeof current === 'number') stats.numbers += 1
    if (typeof current === 'boolean') stats.booleans += 1
  }
  visit(value, 0)
  return stats
}

export function parseJson(text: string): JsonParseResult {
  if (!text.trim()) {
    return {
      ok: false,
      issue: { code: 'ValueExpected', message: '请输入 JSON 文本', line: 1, column: 1, offset: 0, length: 1, lineText: '', caret: '^' },
    }
  }
  const errors: ParseError[] = []
  const value = parse(text, errors, { allowTrailingComma: false, disallowComments: true, allowEmptyContent: false })
  if (errors.length) return { ok: false, issue: locate(text, errors[0]) }
  return { ok: true, value, stats: collectStats(value) }
}

export function stringifyJson(value: unknown, indent: '2' | '4' | 'tab') {
  return JSON.stringify(value, null, indent === 'tab' ? '\t' : Number(indent))
}

export function minifyJson(value: unknown) {
  return JSON.stringify(value)
}

export function findJsonMatches(value: unknown, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return [] as JsonSearchMatch[]

  const matches: JsonSearchMatch[] = []
  const isPathQuery = needle.startsWith('$')

  function visit(current: unknown, path: string, nodeKey?: string | number) {
    const matchedBy: JsonSearchMatch['matchedBy'] = []
    const keyText = nodeKey === undefined ? '' : String(nodeKey).toLocaleLowerCase()
    if (!isPathQuery && keyText.includes(needle)) matchedBy.push('key')
    if (isPathQuery && path.toLocaleLowerCase() === needle) matchedBy.push('path')

    const isContainer = current !== null && typeof current === 'object'
    if (!isPathQuery && !isContainer) {
      const valueText = typeof current === 'string' ? current : String(current)
      if (valueText.toLocaleLowerCase().includes(needle)) matchedBy.push('value')
    }
    if (matchedBy.length) matches.push({ path, matchedBy })

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, index))
      return
    }
    if (current !== null && typeof current === 'object') {
      Object.entries(current as Record<string, unknown>).forEach(([key, item]) => {
        const childPath = /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`
        visit(item, childPath, key)
      })
    }
  }

  visit(value, '$')
  return matches
}

export function utf8Size(value: string) {
  return new TextEncoder().encode(value).length
}
