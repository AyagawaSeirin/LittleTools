import { RegExpParser, visitRegExpAST, type AST } from '@eslint-community/regexpp'
import { regexReference } from '../data/regexReference'
import type { RegexEngine } from './regex'
export interface RegexToken { from: number; to: number; label: string; description: string; kind: string; depth: number; reference: string }
export interface RegexExplanation { tokens: RegexToken[]; note?: string }
const referenceMap = new Map(regexReference.map((ref) => [ref.id, ref]))
export function explainRegex(pattern: string, flags: string, engine: RegexEngine): RegexExplanation {
  if (pattern.length > 20000) return { tokens: [], note: '表达式过长，暂不生成解释。' }
  if (engine === 'pcre') return explainPcre(pattern, flags)
  const tokens: RegexToken[] = []
  function add(node: AST.Node, label: string, description: string, reference: string, kind = reference, from = node.start) {
    let depth = 0, parent = node.parent
    while (parent) { if (['Group', 'CapturingGroup', 'CharacterClass', 'ExpressionCharacterClass'].includes(parent.type) || (parent.type === 'Assertion' && 'alternatives' in parent)) depth++; parent = parent.parent }
    tokens.push({ from, to: node.end, label, description, kind, depth, reference })
  }
  function addRef(node: AST.Node, id: string, kind?: string) { const ref = referenceMap.get(id)!; add(node, ref.title, ref.description, id, kind) }
  try {
    const root = new RegExpParser({ ecmaVersion: 2025 }).parsePattern(pattern, 0, pattern.length, { unicode: flags.includes('u'), unicodeSets: flags.includes('v') })
    let group = 0
    visitRegExpAST(root, {
      onCapturingGroupEnter(node) { group++; add(node, `捕获分组 #${group}${node.name ? ` · ${node.name}` : ''}`, '保存分组匹配的文本，供详情查看、反向引用和替换使用。', node.name ? 'named-capture' : 'capture', 'group') },
      onGroupEnter(node) { add(node, node.modifiers ? '局部修饰符分组' : '非捕获分组', node.modifiers ? '只在该分组内启用或关闭 i、m、s 修饰符，需要浏览器支持。' : '组合元素但不创建捕获分组。', 'non-capture', 'group') },
      onCharacterClassEnter(node) { addRef(node, node.negate ? 'negated-set' : 'set', 'class') },
      onExpressionCharacterClassEnter(node) { addRef(node, node.negate ? 'negated-set' : 'set', 'class') },
      onCharacterClassRangeEnter(node) { add(node, '字符范围', `匹配 ${JSON.stringify(String.fromCodePoint(node.min.value))} 到 ${JSON.stringify(String.fromCodePoint(node.max.value))} 之间的字符。`, 'range', 'class') },
      onCharacterSetEnter(node) {
        if (node.kind === 'any') add(node, '任意字符', flags.includes('s') ? '匹配包括换行在内的任意字符。' : '匹配除换行外的任意字符。', 'dot', 'class')
        else if (node.kind === 'property') add(node, node.negate ? '排除 Unicode 属性' : 'Unicode 属性', `匹配${node.negate ? '不' : ''}具有 ${node.key}${node.value ? `=${node.value}` : ''} 属性的${node.strings ? '字符或字符串' : '字符'}。`, 'unicode-property', 'class')
        else addRef(node, `${node.negate ? 'not-' : ''}${node.kind}`, 'class')
      },
      onAssertionEnter(node) {
        const id = node.kind === 'word' ? (node.negate ? 'not-boundary' : 'boundary') : node.kind === 'lookahead' || node.kind === 'lookbehind' ? `${node.negate ? 'negative-' : ''}${node.kind}` : node.kind
        addRef(node, id, 'assertion')
      },
      onBackreferenceEnter(node) { add(node, '反向引用', `再次匹配分组 ${String(node.ref)} 捕获的文本。`, typeof node.ref === 'string' ? 'named-reference' : 'backreference', 'group') },
      onQuantifierEnter(node) {
        const count = node.min === node.max ? `恰好 ${node.min} 次` : node.max === Infinity ? `至少 ${node.min} 次` : `${node.min} 到 ${node.max} 次`
        add(node, `${node.greedy ? '贪婪' : '非贪婪'}量词`, `重复前一个元素${count}，${node.greedy ? '尽可能多地' : '尽可能少地'}匹配。`, node.greedy ? 'repeat' : 'lazy', 'quantifier', node.element.end)
      },
      onCharacterEnter(node) {
        if (node.parent.type === 'CharacterClassRange') return
        add(node, node.raw.startsWith('\\') ? '转义字符' : '普通字符', `匹配字符 ${JSON.stringify(String.fromCodePoint(node.value))}（U+${node.value.toString(16).toUpperCase().padStart(4, '0')}）。`, 'escape', 'literal')
      },
      onAlternativeEnter(node) { if (node.parent.alternatives.indexOf(node) > 0) tokens.push({ from: node.start - 1, to: node.start, label: '分支', description: '尝试另一种匹配方式。', kind: 'alternation', depth: 0, reference: 'alternation' }) },
      onClassIntersectionEnter(node) { addRef(node, 'intersection', 'class') },
      onClassSubtractionEnter(node) { addRef(node, 'subtraction', 'class') },
      onClassStringDisjunctionEnter(node) { addRef(node, 'class-string', 'class') },
    })
    return { tokens: tokens.sort((a, b) => a.from - b.from || b.to - a.to) }
  } catch { return { tokens: [], note: '修正表达式后显示结构解释。运行结果以当前浏览器的正则引擎为准。' } }
}
function explainPcre(pattern: string, flags: string): RegexExplanation {
  const tokens: RegexToken[] = []
  let index = 0, depth = 0
  function push(length: number, reference: string, kind: string, label?: string, description?: string) {
    const ref = referenceMap.get(reference)
    tokens.push({ from: index, to: index + length, label: label ?? ref?.title ?? 'PCRE 语法', description: description ?? ref?.description ?? '此结构由 PCRE2 引擎解析。', reference, kind, depth })
    index += length
  }
  const escapes: Record<string, string> = { d: 'digit', D: 'not-digit', w: 'word', W: 'not-word', s: 'space', S: 'not-space', b: 'boundary', B: 'not-boundary', A: 'absolute-start', z: 'absolute-end', Z: 'soft-end', G: 'previous', K: 'reset', R: 'linebreak', X: 'grapheme', h: 'horizontal', H: 'horizontal', n: 'newline', r: 'return', t: 'tab', f: 'formfeed', v: 'verticaltab', V: 'verticaltab' }
  while (index < pattern.length) {
    const rest = pattern.slice(index), char = pattern[index]!
    if (flags.includes('x') && /\s/.test(char)) { push(1, 'comment', 'comment', '扩展模式空白'); continue }
    if (flags.includes('x') && char === '#') { push(rest.indexOf('\n') < 0 ? rest.length : rest.indexOf('\n'), 'comment', 'comment'); continue }
    if (rest.startsWith('\\Q')) { const end = rest.indexOf('\\E', 2); push(end < 0 ? rest.length : end + 2, 'quote', 'literal'); continue }
    if (rest.startsWith('(?#')) { const end = rest.indexOf(')'); push(end < 0 ? rest.length : end + 1, 'comment', 'comment'); continue }
    if (char === '[') {
      let end = index + 1
      if (pattern[end] === '^') end++
      if (pattern[end] === ']') end++
      while (end < pattern.length) {
        if (pattern[end] === '\\') { end += 2; continue }
        if (pattern.slice(end, end + 2) === '[:') { const close = pattern.indexOf(':]', end + 2); if (close >= 0) { end = close + 2; continue } }
        if (pattern[end++] === ']') break
      }
      push(end - index, rest.startsWith('[^') ? 'negated-set' : 'set', 'class'); continue
    }
    if (char === '\\') {
      const extended = /^\\(?:[pP]\{[^}]*\}|[kg](?:<[^>]*>|\{[^}]*\}|'[^']*')|x(?:\{[^}]*\}|[\da-fA-F]{2})|[1-9]\d*|c[A-Za-z])/.exec(rest)?.[0]
      if (extended) { push(extended.length, /\\[pP]/.test(extended) ? 'unicode-property' : /\\x/.test(extended) ? 'hex' : 'backreference', 'class'); continue }
      push(Math.min(2, rest.length), escapes[rest[1]!] ?? 'escape', 'class'); continue
    }
    const standalone = /^\(\?(?:R|[+-]?\d+|&[^)]+|P[=>][^)]+|[imsxUJn-]+)\)|^\(\*[^)]*\)/.exec(rest)?.[0]
    if (standalone) { push(standalone.length, standalone.startsWith('(*') ? 'verbs' : standalone === '(?R)' ? 'recursion' : /^\(\?[imsxUJn-]+\)/.test(standalone) ? 'modifiers' : 'subroutine', 'group'); continue }
    if (char === '(') {
      const opening = /^\(\?(?:<[=!]|[=:!>|]|<[^>]+>|P<[^>]+>|'[^']+'|[imsxUJn-]+:|\([^)]*\))/.exec(rest)?.[0] ?? '('
      const id = opening.startsWith('(?<=') ? 'lookbehind' : opening.startsWith('(?<!') ? 'negative-lookbehind' : opening.startsWith('(?=') ? 'lookahead' : opening.startsWith('(?!') ? 'negative-lookahead' : opening.startsWith('(?>') ? 'atomic' : opening.startsWith('(?|') ? 'branch-reset' : opening.startsWith('(?(') ? 'conditional' : opening === '(?:' ? 'non-capture' : opening.length > 3 && opening.endsWith(':') ? 'modifiers' : opening === '(' ? 'capture' : 'named-capture'
      push(opening.length, id, 'group'); depth++; continue
    }
    if (char === ')') { depth = Math.max(0, depth - 1); push(1, 'non-capture', 'group', '分组结束', '结束当前分组。后续量词将作用于整个分组。'); continue }
    const quantifier = /^(?:[?*+]|\{\d+(?:,\d*)?\})[?+]?/.exec(rest)?.[0]
    if (quantifier) {
      const possessive = quantifier.length > 1 && quantifier.endsWith('+')
      const lazySuffix = quantifier.length > 1 && quantifier.endsWith('?')
      const greedy = flags.includes('U') ? lazySuffix : !lazySuffix
      const base = possessive || lazySuffix ? quantifier.slice(0, -1) : quantifier
      const count = base === '*' ? '零次或多次' : base === '+' ? '一次或多次' : base === '?' ? '零次或一次' : `指定次数 ${base}`
      push(quantifier.length, possessive ? 'possessive' : lazySuffix ? 'lazy' : base === '*' ? 'star' : base === '+' ? 'plus' : base === '?' ? 'optional' : 'repeat', 'quantifier', `${count} · ${possessive ? '占有' : greedy ? '贪婪' : '非贪婪'}`, `重复前一个元素${count}。${possessive ? '尽量多匹配且不交还字符参与回溯。' : greedy ? '在整体匹配成功的前提下尽量多匹配。' : '在整体匹配成功的前提下尽量少匹配。'}`)
      continue
    }
    if ('^$.|'.includes(char)) { push(1, ({ '^': 'start', '$': 'end', '.': 'dot', '|': 'alternation' } as Record<string, string>)[char]!, char === '.' ? 'class' : 'assertion'); continue }
    const codePoint = pattern.codePointAt(index) ?? 0
    push(codePoint > 0xffff ? 2 : 1, 'escape', 'literal', '普通字符', `匹配字符 ${JSON.stringify(String.fromCodePoint(codePoint))}（U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}）。`)
  }
  return { tokens, note: 'PCRE 按语法片段解释；条件、递归和局部选项的实际行为以 PCRE2 运行结果为准。' }
}
