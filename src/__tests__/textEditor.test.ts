import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { SearchQuery } from '@codemirror/search'
import { findTextMatch, textReplacementChanges } from '../utils/textEditor'

function replace(source: string, search: string, replacement: string, regexp = true, selected?: { from: number; to: number }) {
  const state = EditorState.create({ doc: source })
  const query = new SearchQuery({ search, replace: replacement, regexp, caseSensitive: true, literal: !regexp })
  return state.update({ changes: textReplacementChanges(state, query, selected) }).state.doc.toString()
}

describe('text editor search and replacement', () => {
  it('treats plain search and replacement as literal text', () => {
    expect(replace('a.b aXb a.b', 'a.b', '$1\\n', false)).toBe('$1\\n aXb $1\\n')
    expect(replace('a\\nb\na\\nb', '\\n', '|', false)).toBe('a|b\na|b')
  })

  it('matches JavaScript capture replacement including optional and named groups', () => {
    const source = 'item-12 item-34 56'
    const pattern = '(?<prefix>item-)?(\\d+)'
    const template = '$<prefix>[$2] $1 $$ $& $12 $99'
    expect(replace(source, pattern, template)).toBe(source.replace(new RegExp(pattern, 'gmu'), template))
  })

  it('expands prefix and suffix tokens using the full document', () => {
    const source = 'aa\n12\nbb'
    expect(replace(source, '\\d+', "$`/$&/$'")).toBe(source.replace(/\d+/gmu, "$`/$&/$'"))
  })

  it('supports multiline searches, newlines, tabs and empty replacements', () => {
    expect(replace('a\nb\na\nb', 'a\\nb', 'x\\ny\\t')).toBe('x\ny\t\nx\ny\t')
    expect(replace('a1b22c', '\\d+', '')).toBe('abc')
  })

  it('preserves lookbehind and document context for a single replacement', () => {
    expect(replace('x12 x34', '(?<=x)\\d+', '[$&]', true, { from: 5, to: 7 })).toBe('x12 x[34]')
  })

  it('replaces zero-width matches once per position, including Unicode text', () => {
    expect(replace('你好\n🌏\n', '^', '> ')).toBe('> 你好\n> 🌏\n> ')
    expect(replace('🌏a', '(?=.)', '|')).toBe('|🌏|a')
  })

  it('does not edit for empty, invalid or unmatched searches', () => {
    expect(replace('text', '', 'x')).toBe('text')
    expect(replace('text', '[', 'x')).toBe('text')
    expect(replace('text', 'missing', 'x')).toBe('text')
  })

  it('moves past zero-width matches and wraps in both directions', () => {
    const state = EditorState.create({ doc: 'a\nb\nc' })
    const query = new SearchQuery({ search: '^', regexp: true })
    expect(findTextMatch(state, query, { from: 0, to: 0 }, 1)).toMatchObject({ from: 2, to: 2 })
    expect(findTextMatch(state, query, { from: 4, to: 4 }, 1)).toMatchObject({ from: 0, to: 0 })
    expect(findTextMatch(state, query, { from: 0, to: 0 }, -1)).toMatchObject({ from: 4, to: 4 })
    expect(findTextMatch(state, query, { from: 4, to: 4 }, -1)).toMatchObject({ from: 2, to: 2 })
  })

  it('keeps navigation consistent with non-overlapping replacement matches', () => {
    const state = EditorState.create({ doc: 'aaaa' })
    const query = new SearchQuery({ search: 'aa', literal: true })
    expect(findTextMatch(state, query, { from: 0, to: 2 }, 1)).toMatchObject({ from: 2, to: 4 })
    expect(findTextMatch(state, query, { from: 2, to: 4 }, 1)).toMatchObject({ from: 0, to: 2 })
    expect(replace('aaaa', 'aa', 'b', false)).toBe('bb')
  })
})
