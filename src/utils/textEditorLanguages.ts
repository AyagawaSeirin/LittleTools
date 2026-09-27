import { HighlightStyle } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { tags } from '@lezer/highlight'

const commonNames = [
  'JavaScript', 'TypeScript', 'JSX', 'TSX', 'Python', 'Java', 'C', 'C++', 'C#',
  'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'Scala', 'R', 'Julia',
  'Lua', 'Perl', 'Shell', 'PowerShell', 'HTML', 'CSS', 'SCSS', 'LESS', 'Vue',
  'SQL', 'MySQL', 'PostgreSQL', 'JSON', 'YAML', 'XML', 'Markdown', 'TOML', 'Dockerfile',
]
const byName = new Map(languages.map((language) => [language.name, language]))

export const editorLanguageGroups = [
  { label: '常用语言与格式', languages: commonNames.map((name) => byName.get(name)!) },
  { label: '其他语言与格式', languages: languages.filter((language) => !commonNames.includes(language.name)).sort((a, b) => a.name.localeCompare(b.name, 'en')) },
]

export async function loadEditorLanguage(name: string) {
  if (name === 'plain') return []
  const description = byName.get(name)
  if (!description) throw new Error('未知的高亮语言')
  const support = await description.load()
  // Only install the parser, not optional features such as HTML auto-close input handlers.
  return support.language
}

// Stable classes let both themes and detached windows use the same highlighting rules.
export const editorHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, class: 'text-syntax-keyword' },
  { tag: [tags.string, tags.regexp, tags.special(tags.string)], class: 'text-syntax-string' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], class: 'text-syntax-number' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], class: 'text-syntax-type' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: 'text-syntax-function' },
  { tag: [tags.propertyName, tags.attributeName], class: 'text-syntax-property' },
  { tag: [tags.comment, tags.meta], class: 'text-syntax-comment' },
  { tag: tags.heading, class: 'text-syntax-heading' },
  { tag: tags.strong, class: 'text-syntax-strong' },
  { tag: tags.emphasis, class: 'text-syntax-emphasis' },
  { tag: [tags.link, tags.url], class: 'text-syntax-link' },
  { tag: tags.strikethrough, class: 'text-syntax-strike' },
  { tag: tags.invalid, class: 'text-syntax-invalid' },
])
