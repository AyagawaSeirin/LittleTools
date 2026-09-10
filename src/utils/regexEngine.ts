import { RegExpParser } from '@eslint-community/regexpp'
import { advanceIndex, blankResult, buildOutputs, MATCH_LIMIT, testPassed, validateDocument, type RegexDocument, type RegexMatch, type RegexResult } from './regex'

export interface RegexRunner {
  collect: (text: string, limit: number) => { matches: RegexMatch[]; truncated: boolean }
  destroy: () => void
}
export function javascriptRunner(doc: RegexDocument): RegexRunner {
  let regex: RegExp
  try {
    regex = new RegExp(doc.pattern, doc.flags.includes('d') ? doc.flags : `${doc.flags}d`)
  } catch (error) {
    // The browser is authoritative; regexpp adds a source offset when available.
    try { new RegExpParser({ ecmaVersion: 2025 }).parsePattern(doc.pattern, 0, doc.pattern.length, { unicode: doc.flags.includes('u'), unicodeSets: doc.flags.includes('v') }) }
    catch (issue) { if (issue instanceof Error && 'index' in issue) Object.assign(error as Error, { offset: issue.index }) }
    throw error
  }
  return {
    collect(text, limit) {
      regex.lastIndex = 0
      const matches: RegexMatch[] = []
      const global = doc.flags.includes('g'), unicode = doc.flags.includes('u') || doc.flags.includes('v')
      for (;;) {
        const match = regex.exec(text)
        if (!match) return { matches, truncated: false }
        if (matches.length === limit) return { matches, truncated: true }
        matches.push({ from: match.index, to: match.index + match[0].length, value: match[0], groups: match.slice(1).map((g) => g ?? null), namedGroups: Object.fromEntries(Object.entries(match.groups ?? {}).map(([k, v]) => [k, v ?? null])), groupRanges: match.indices?.slice(1).map((range) => range ?? null) })
        if (!global) return { matches, truncated: false }
        if (!match[0].length) regex.lastIndex = advanceIndex(text, regex.lastIndex, unicode)
      }
    },
    destroy() {},
  }
}
export async function evaluateRegex(input: RegexDocument): Promise<RegexResult> {
  const start = performance.now(), result = blankResult()
  let runner: RegexRunner | undefined
  try {
    const doc = validateDocument(input)
    runner = doc.engine === 'javascript' ? javascriptRunner(doc) : await (await import('./regexPcre')).pcreRunner(doc)
    Object.assign(result, runner.collect(doc.text, MATCH_LIMIT))
    if (!result.truncated) {
      try { Object.assign(result, buildOutputs(doc, result.matches)) }
      catch (error) { result.outputError = error instanceof Error ? error.message : String(error) }
    } else result.outputError = `超过 ${MATCH_LIMIT.toLocaleString()} 处匹配。高亮与详情仅显示前 ${MATCH_LIMIT.toLocaleString()} 处；请缩小输入后再生成完整输出。`
    for (const test of doc.tests) {
      try {
        const found = runner.collect(test.text, test.mode === 'count' ? MATCH_LIMIT : 1)
        result.tests.push({ id: test.id, passed: testPassed(test, found.matches, found.truncated), count: found.matches.length, truncated: found.truncated })
      } catch (error) { result.tests.push({ id: test.id, passed: false, count: 0, truncated: false, error: error instanceof Error ? error.message : String(error) }) }
    }
  } catch (error) {
    Object.assign(result, blankResult())
    result.error = error instanceof Error ? error.message : String(error)
    if (error instanceof Error && 'offset' in error && typeof error.offset === 'number') result.errorOffset = error.offset
  } finally { runner?.destroy() }
  result.elapsed = performance.now() - start
  return result
}
