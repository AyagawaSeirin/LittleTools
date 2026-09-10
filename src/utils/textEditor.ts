import type { EditorState } from '@codemirror/state'
import type { SearchQuery } from '@codemirror/search'

interface TextMatch { from: number; to: number }

/** Iterate the same non-overlapping matches used by highlighting and replace-all. */
export function findTextMatch(state: EditorState, query: SearchQuery, selected: TextMatch, direction: -1 | 1): TextMatch | undefined {
  if (!query.valid) return
  let first: TextMatch | undefined
  let last: TextMatch | undefined
  let previous: TextMatch | undefined
  const cursor = query.getCursor(state)
  for (let result = cursor.next(); !result.done; result = cursor.next()) {
    const match = result.value
    first ??= match
    last = match
    const isCurrent = match.from === selected.from && match.to === selected.to
    if (direction === 1 && match.from >= selected.to && !isCurrent) return match
    if (direction === -1 && match.to <= selected.from && !isCurrent) previous = match
  }
  return direction === 1 ? first : previous ?? last
}

/** JavaScript replacement tokens, including unmatched and named capture groups. */
function expandReplacement(template: string, match: RegExpExecArray, source: string, from: number) {
  return template.replace(/\$([$&`']|\d{1,2}|<[^>]*>)/g, (token: string, name: string) => {
    if (name === '$') return '$'
    if (name === '&') return match[0]
    if (name === '`') return source.slice(0, from)
    if (name === "'") return source.slice(from + match[0].length)
    if (name.startsWith('<')) return match.groups ? match.groups[name.slice(1, -1)] ?? '' : token
    const number = Number(name)
    if (number > 0 && number < match.length) return match[number] ?? ''
    const first = Number(name[0])
    if (name.length === 2 && first > 0 && first < match.length) return (match[first] ?? '') + name[1]
    return token
  })
}

export function textReplacementChanges(state: EditorState, query: SearchQuery, selected?: TextMatch) {
  const changes: { from: number; to: number; insert: string }[] = []
  if (!query.valid) return changes
  const template = query.regexp
    ? query.replace.replace(/\\([nrt\\])/g, (_, character: string) => ({ n: '\n', r: '\r', t: '\t', '\\': '\\' })[character]!)
    : query.replace
  const source = query.regexp && /\$[`']/.test(template) ? state.doc.toString() : ''
  const cursor = query.getCursor(state)
  for (let result = cursor.next(); !result.done; result = cursor.next()) {
    const match = result.value as TextMatch & { precise?: boolean; match?: RegExpExecArray }
    if (selected && (match.from !== selected.from || match.to !== selected.to)) continue
    // A normalized plain-text match may only cover part of a Unicode character.
    if (match.precise === false) continue
    changes.push({ from: match.from, to: match.to, insert: match.match ? expandReplacement(template, match.match, source, match.from) : template })
    if (selected) break
  }
  return changes
}
