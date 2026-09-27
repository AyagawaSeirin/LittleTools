import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { highlightTree } from '@lezer/highlight'
import { editorHighlightStyle, editorLanguageGroups, loadEditorLanguage } from '../utils/textEditorLanguages'
import examples from './fixtures/textSyntax.json'

describe('text editor syntax highlighting', () => {
  it('loads every selectable language, with unique names and no missing common languages', async () => {
    const languages = editorLanguageGroups.flatMap((group) => group.languages)
    expect(new Set(languages.map((language) => language.name)).size).toBe(languages.length)
    expect(editorLanguageGroups[0]!.languages.map((language) => language.name)).toEqual(examples.map((example) => example.language))
    for (const language of languages) {
      const extension = await loadEditorLanguage(language.name)
      expect(extension, language.name).toHaveProperty('parser')
    }
  })

  it.each(examples)('highlights $language code without changing the source', async ({ language, source }) => {
    const state = EditorState.create({ doc: source, extensions: [await loadEditorLanguage(language)] })
    const tree = ensureSyntaxTree(state, state.doc.length, 2000)
    expect(tree, language).not.toBeNull()
    const tokens: { text: string; classes: string }[] = []
    highlightTree(tree!, editorHighlightStyle, (from, to, classes) => tokens.push({ text: source.slice(from, to), classes }))
    expect(tokens.length, language).toBeGreaterThan(0)
    expect(tokens.every((token) => token.classes.includes('text-syntax-')), language).toBe(true)
    expect(state.doc.toString()).toBe(source)
    if (language === 'JavaScript') {
      expect(tokens).toEqual(expect.arrayContaining([
        { text: 'const', classes: 'text-syntax-keyword' },
        { text: '42', classes: 'text-syntax-number' },
        { text: '// 本地代码', classes: 'text-syntax-comment' },
      ]))
    }
  })

  it('supports turning highlighting off and rejects unknown language names', async () => {
    expect(await loadEditorLanguage('plain')).toEqual([])
    await expect(loadEditorLanguage('missing-language')).rejects.toThrow('未知的高亮语言')
  })
})
