import { createPCRE2, FLAGS, MATCH_FLAGS, type PCRE2 } from 'pcre2-wasm'
import { advanceIndex, type RegexDocument, type RegexMatch } from './regex'
import type { RegexRunner } from './regexEngine'

let instance: Promise<PCRE2> | undefined
const flagsMap: Record<string, number> = { g: 0, i: FLAGS.CASELESS, m: FLAGS.MULTILINE, s: FLAGS.DOTALL, u: FLAGS.UTF | FLAGS.UCP, x: FLAGS.EXTENDED, U: FLAGS.UNGREEDY, A: FLAGS.ANCHORED, D: FLAGS.DOLLAR_ENDONLY, J: FLAGS.DUPNAMES, n: FLAGS.NO_AUTO_CAPTURE }
export async function pcreRunner(doc: RegexDocument): Promise<RegexRunner> {
  // The WASM wrapper's C strings cannot represent embedded NUL bytes. Reject explicitly.
  if (doc.pattern.includes('\0')) throw new Error('PCRE 引擎不支持表达式中的 NUL 字符，请使用 \\x00。')
  const pcre = await (instance ??= createPCRE2())
  // The package converts compile offsets from UTF-8 to UTF-16 already.
  const regex = pcre.compile(doc.pattern, [...doc.flags].reduce((mask, flag) => mask | flagsMap[flag]!, 0))
  const unicode = doc.flags.includes('u') || /\(\*(?:UTF|UCP)\)/.test(doc.pattern)
  return {
    collect(text, limit) {
      if (text.includes('\0')) throw new Error('PCRE 引擎暂不支持包含 NUL 的测试文本，请切换 JavaScript 引擎。')
      // In byte mode, the wrapper decodes partial UTF-8 matches lossily. Do not report corrupt ranges.
      if (!unicode && /[^\x00-\x7f]/.test(text)) throw new Error('PCRE 匹配非 ASCII 文本时请启用 u（Unicode），以正确显示字符与匹配位置。')
      const matches: RegexMatch[] = []
      let startPos = 0, retryEmpty = false
      while (startPos <= text.length) {
        const found = regex.match(text, { startPos, matchLimit: 1_000_000, depthLimit: 1000, matchFlags: retryEmpty ? MATCH_FLAGS.NOTEMPTY_ATSTART | FLAGS.ANCHORED : 0 })
        if (!found) {
          if (!retryEmpty) break
          startPos = advanceIndex(text, startPos, unicode)
          retryEmpty = false
          continue
        }
        if (matches.length === limit) return { matches, truncated: true }
        const to = found.index + found.match.length
        if (found.index < startPos || to > text.length || text.slice(found.index, to) !== found.match) throw new Error('此 PCRE 字节匹配无法映射到文本位置，请启用 u 或使用 Unicode 字符表达式。')
        matches.push({ from: found.index, to, value: found.match, groups: found.groups, namedGroups: found.namedGroups ?? {} })
        if (!doc.flags.includes('g')) break
        startPos = to
        // PCRE global matching retries a non-empty alternative at the same position.
        retryEmpty = found.match.length === 0
      }
      return { matches, truncated: false }
    },
    destroy: () => regex.destroy(),
  }
}
