import { describe, expect, it } from 'vitest'
import { decodeDocument, emptyDocument, encodeDocument, exampleDocument, MATCH_LIMIT, validateDocument, type RegexDocument } from '../utils/regex'
import { evaluateRegex } from '../utils/regexEngine'
import { explainRegex } from '../utils/regexExplain'
import { regexExamples } from '../data/regexExamples'
const evaluate = (values: Partial<RegexDocument>) => evaluateRegex({ ...emptyDocument(), ...values })

describe('JavaScript regex workbench', () => {
  it('preserves named captures, unmatched vs empty groups and exact UTF-16 ranges', async () => {
    const result = await evaluate({ pattern: '(?<name>a)(b)?()', text: '🌏a ab', flags: 'gu' })
    expect(result.error).toBeUndefined()
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]).toMatchObject({ from: 2, to: 3, groups: ['a', null, ''], namedGroups: { name: 'a' }, groupRanges: [[2, 3], null, [3, 3]] })
  })
  it('matches browser flags including sticky, multiline, dotAll and Unicode sets', async () => {
    expect((await evaluate({ pattern: '\\d+', text: 'a12 b34', flags: '' })).matches.map((m) => m.value)).toEqual(['12'])
    expect((await evaluate({ pattern: '\\d+', text: 'a12 b34', flags: 'gy' })).matches).toEqual([])
    expect((await evaluate({ pattern: '\\d', text: '12x34', flags: 'gy' })).matches.map((m) => m.value)).toEqual(['1', '2'])
    expect((await evaluate({ pattern: '^a.', text: 'a1\nA\n', flags: 'gims' })).matches.map((m) => m.value)).toEqual(['a1', 'A\n'])
    expect((await evaluate({ pattern: '[\\p{L}&&\\p{ASCII}]+', text: '你好 ABC', flags: 'gv' })).matches[0]?.value).toBe('ABC')
  })
  it('advances zero-width matches by code point in u/v and by code unit otherwise', async () => {
    for (const flags of ['gu', 'gv']) expect((await evaluate({ pattern: '', text: '🌏a', flags })).matches.map((m) => m.from)).toEqual([0, 2, 3])
    expect((await evaluate({ pattern: '', text: '🌏a', flags: 'g' })).matches.map((m) => m.from)).toEqual([0, 1, 2, 3])
    expect((await evaluate({ pattern: '$', text: '', flags: 'g' })).matches).toHaveLength(1)
  })
  it('replaces with native capture, prefix, suffix and numeric-fallback semantics', async () => {
    const text = 'x a ab y', pattern = '(?<one>a)(b)?()'
    const replacement = '$$:$&:$0:$1:$2:$3:$12:$01:$99:$<one>:$<missing>:$<__proto__>:$<toString>:$`:$\''
    const result = await evaluate({ pattern, text, replacement, flags: 'g', listTemplate: '$1\\t$2\\n' })
    expect(result.replacement).toBe(text.replace(new RegExp(pattern, 'g'), replacement))
    expect(result.list).toBe('a\t\na\tb\n')
    expect((await evaluate({ pattern: '(a)', text: 'a', replacement: '$<unknown>', flags: 'g' })).replacement).toBe('$<unknown>')
  })
  it('supports empty replacement, escaped newlines and lookbehind with full context', async () => {
    expect((await evaluate({ pattern: '(?<=x)\\d+', text: 'x12 x34', replacement: '', flags: 'g' })).replacement).toBe('x x')
    expect((await evaluate({ pattern: '^', text: '🌏\nhello', replacement: '>\\t', flags: 'gmu' })).replacement).toBe('>\t🌏\n>\thello')
    expect((await evaluate({ pattern: 'a', text: 'a', replacement: '\\\\n', flags: 'g' })).replacement).toBe('\\n')
  })
  it('reports invalid syntax with an offset and rejects unsupported/duplicate flags', async () => {
    const result = await evaluate({ pattern: '(' })
    expect(result.error).toBeTruthy()
    expect(result.errorOffset).toBeTypeOf('number')
    for (const flags of ['gg', 'uv', 'x']) expect((await evaluate({ flags })).error).toBeTruthy()
  })
  it('caps matches without silently offering a partial replacement', async () => {
    const result = await evaluate({ pattern: 'a', text: 'a'.repeat(MATCH_LIMIT + 1), replacement: 'b' })
    expect(result.matches).toHaveLength(MATCH_LIMIT)
    expect(result.truncated).toBe(true)
    expect(result.outputError).toBeTruthy()
    expect(result.replacement).toBe('')
    expect((await evaluate({ pattern: 'a', text: 'a'.repeat(MATCH_LIMIT) })).truncated).toBe(false)
  })
  it('caps expanding outputs without losing match details', async () => {
    const result = await evaluate({ pattern: '.', text: 'a'.repeat(2000), replacement: "$'" })
    expect(result.matches).toHaveLength(2000)
    expect(result.outputError).toBeTruthy()
  })
  it('runs test suites independently, including the empty string and g semantics', async () => {
    const tests = [
      { id: '1', name: 'full', text: '12', mode: 'full' as const, count: 1 },
      { id: '2', name: 'partial', text: 'x12', mode: 'partial' as const, count: 1 },
      { id: '3', name: 'negative', text: 'abc', mode: 'none' as const, count: 0 },
      { id: '4', name: 'count', text: '12 34', mode: 'count' as const, count: 2 },
      { id: '5', name: 'not full', text: 'x12', mode: 'full' as const, count: 1 },
    ]
    const result = await evaluate({ pattern: '\\d+', tests })
    expect(result.tests.map((t) => t.passed)).toEqual([true, true, true, true, false])
    expect((await evaluate({ pattern: '\\d+', flags: '', tests })).tests[3]?.passed).toBe(false)
    expect((await evaluate({ pattern: '^$', tests: [{ id: 'empty', name: '', text: '', mode: 'full', count: 1 }] })).tests[0]?.passed).toBe(true)
  })
})

describe('real PCRE2 engine', () => {
  it('supports recursion, atomic groups, possessive quantifiers, conditionals and branch reset', async () => {
    expect((await evaluate({ engine: 'pcre', pattern: '\\((?:[^()]|(?R))*\\)', text: '(a(b)c)(d)', flags: 'gu' })).matches.map((m) => m.value)).toEqual(['(a(b)c)', '(d)'])
    expect((await evaluate({ engine: 'pcre', pattern: '(?>a|ab)c', text: 'abc', flags: 'gu' })).matches).toEqual([])
    expect((await evaluate({ engine: 'pcre', pattern: 'a++a', text: 'aaa', flags: 'gu' })).matches).toEqual([])
    expect((await evaluate({ engine: 'pcre', pattern: '(a)?(?(1)b|c)', text: 'ab c', flags: 'gu' })).matches.map((m) => m.value)).toEqual(['ab', 'c'])
    expect((await evaluate({ engine: 'pcre', pattern: '(?|(a)|(b))', text: 'a b', flags: 'gu' })).matches.map((m) => m.groups)).toEqual([['a'], ['b']])
  })
  it('returns correct Unicode positions, named groups and reset-start matches', async () => {
    const result = await evaluate({ engine: 'pcre', pattern: '(?<name>\\p{L}+)=\\K(?<value>\\d+)', text: '🌏数量=12 test=34', flags: 'gu', replacement: '${name}:$<value>:$0' })
    expect(result.error).toBeUndefined()
    expect(result.matches.map((m) => [m.from, m.to, m.value])).toEqual([[5, 7, '12'], [13, 15, '34']])
    expect(result.replacement).toBe('🌏数量=数量:12:12 test=test:34:34')
  })
  it('handles zero-width Unicode and non-empty alternatives at the same position', async () => {
    expect((await evaluate({ engine: 'pcre', pattern: '', text: '🌏a', flags: 'gu' })).matches.map((m) => m.from)).toEqual([0, 2, 3])
    const result = await evaluate({ engine: 'pcre', pattern: '(?:|a)', text: 'a', flags: 'gu', replacement: 'x' })
    expect(result.error).toBeUndefined()
    expect(result.matches.map((m) => m.value)).toEqual(['', 'a', ''])
    expect(result.replacement).toBe('xxx')
  })
  it('uses PHP-compatible U for ungreedy, n for no capture and x comments', async () => {
    expect((await evaluate({ engine: 'pcre', pattern: '<.*>', text: '<a><b>', flags: 'gU' })).matches.map((m) => m.value)).toEqual(['<a>', '<b>'])
    expect((await evaluate({ engine: 'pcre', pattern: '(a)(?<b>b)', text: 'ab', flags: 'gn' })).matches[0]?.groups).toEqual(['b'])
    expect((await evaluate({ engine: 'pcre', pattern: 'a # comment\n b', text: 'ab', flags: 'gx' })).matches[0]?.value).toBe('ab')
  })
  it('limits backtracking and explicitly rejects unsupported NUL/byte-text input', async () => {
    expect((await evaluate({ engine: 'pcre', pattern: '^(a+)+$', text: 'a'.repeat(35) + '!', flags: 'g' })).error).toMatch(/limit/i)
    expect((await evaluate({ engine: 'pcre', pattern: '.', text: 'a\0b', flags: 'gu' })).error).toMatch(/NUL/)
    expect((await evaluate({ engine: 'pcre', pattern: '.', text: '中文', flags: 'g' })).error).toMatch(/Unicode/)
    expect((await evaluate({ engine: 'pcre', pattern: '中文(', text: '', flags: 'gu' })).errorOffset).toBe(3)
  })
})

describe('regex documents and reference', () => {
  it('round-trips Chinese, emoji, templates and test suites in share links', () => {
    const doc = { ...exampleDocument(), name: '中文 🌏', text: 'a\r\nb\0' }
    expect(decodeDocument(encodeDocument(doc))).toEqual(doc)
  })
  it('validates untrusted imported files without preserving unknown properties', () => {
    expect(validateDocument({ ...exampleDocument(), injected: 'not retained' })).not.toHaveProperty('injected')
    expect(() => validateDocument({ ...emptyDocument(), text: {} })).toThrow()
    expect(() => validateDocument({ ...emptyDocument(), tests: [{ id: 'x', text: 'a', mode: 'evil' }] })).toThrow()
    expect(() => validateDocument({ ...emptyDocument(), tests: [exampleDocument().tests[0], exampleDocument().tests[0]] })).toThrow()
    expect(() => decodeDocument('broken')).toThrow()
    expect(() => encodeDocument({ ...emptyDocument(), text: 'a'.repeat(50000) })).toThrow()
  })
  it('explains named groups, lookbehind, character classes and Unicode set operations', () => {
    const info = explainRegex('(?<name>[a-z]+)(?<=z)\\1', 'g', 'javascript')
    expect(info.note).toBeUndefined()
    expect(info.tokens.some((t) => t.label === '捕获分组 #1 · name')).toBe(true)
    expect(info.tokens.some((t) => t.reference === 'lookbehind')).toBe(true)
    expect(info.tokens.find((t) => t.kind === 'quantifier')).toMatchObject({ from: 13, to: 14 })
    expect(explainRegex('[\\p{L}&&\\p{ASCII}]', 'v', 'javascript').tokens.some((t) => t.reference === 'intersection')).toBe(true)
    expect(explainRegex('[', 'g', 'javascript').tokens).toEqual([])
  })
  it('does not treat escaped syntax, PCRE quotes or comments as active groups', () => {
    const tokens = explainRegex('\\Q(a+)\\E(?#comment)\\d++', 'gu', 'pcre').tokens
    expect(tokens.map((t) => t.reference)).toEqual(['quote', 'comment', 'digit', 'possessive'])
  })
  it('all built-in examples compile and find results, including the default test suite', async () => {
    for (const item of regexExamples) {
      const result = await evaluateRegex(item.document)
      expect(result.error, item.document.name).toBeUndefined()
      expect(result.matches.length, item.document.name).toBeGreaterThan(0)
    }
    expect((await evaluateRegex(exampleDocument())).tests.every((test) => test.passed)).toBe(true)
  })
})
