import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectLayout } from './responsive-layout.mjs'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const browser = await playwright[browserName].launch({ ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) })
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-text-editor', browserName)
const widths = (process.env.QA_WIDTHS || '320,768,1440').split(',').map(Number)
const themes = (process.env.QA_THEMES || 'light,dark').split(',')
const checks = [], errors = []
await mkdir(outputDir, { recursive: true })

try {
  for (const theme of themes) for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'zh-CN', colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript((theme) => {
      localStorage.setItem('little-tools-mode', theme)
      window.__storageWrites = []
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        window.__storageWrites.push([key, value])
        return setItem.call(this, key, value)
      }
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => {
        if (window.__denyClipboard) throw new Error('Permission denied')
        window.__copiedText = text
      } } })
    }, theme)
    // Finish the app's first Service Worker control reload before editing.
    const warmup = await context.newPage()
    await warmup.goto(baseUrl)
    await warmup.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await warmup.waitForTimeout(250)
    await warmup.close()
    const page = await context.newPage()
    page.setDefaultTimeout(12000)
    page.on('pageerror', (error) => errors.push({ width, theme, error: error.message }))
    await page.goto(baseUrl)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await page.locator('.tool-tile').filter({ hasText: '在线文本编辑器' }).click()
    const content = page.getByRole('textbox', { name: '文本编辑区', exact: true })
    const search = page.getByRole('textbox', { name: '搜索文本', exact: true })
    const replacement = page.getByRole('textbox', { name: '替换文本', exact: true })
    const button = (name) => page.getByRole('button', { name, exact: true })
    const paste = async (source) => {
      await content.focus()
      await content.evaluate((element, source) => {
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/plain', source)
        const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
        // Firefox ignores clipboardData in the synthetic event constructor.
        Object.defineProperty(event, 'clipboardData', { value: clipboardData })
        element.dispatchEvent(event)
      }, source)
    }
    const setText = async (source) => {
      await content.focus()
      await content.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a')
      await paste(source)
    }
    const text = async () => {
      if (await button('复制全文').isDisabled()) return ''
      await button('复制全文').click()
      return page.evaluate(() => window.__copiedText)
    }
    const checkStatus = async (value) => {
      await page.waitForFunction((expected) => document.querySelector('.search-status')?.textContent === expected, value)
    }
    const mark = async (name) => {
      assert.deepEqual(await page.evaluate(inspectLayout), [], `${width} ${theme} ${name}`)
      checks.push({ width, theme, name })
    }
    await content.waitFor()
    await search.waitFor()
    await page.evaluate(() => { window.__storageWrites = [] })
    assert.equal(await text(), '')
    await mark('empty editor and home entry')

    // Paste through the actual clipboard event handler without touching the OS clipboard.
    const original = '你好，世界 🌏\nAlpha alpha ALPHA\nitem-12 item-34\n<a>纯文本</a>'
    await paste(original)
    assert.equal(await text(), original)
    assert.ok((await page.locator('.editor-status').textContent()).includes(`${Array.from(original).length} 字符 · 4 行`))
    assert.equal(await content.locator('a').count(), 0)
    await search.fill('alpha')
    await checkStatus('1 / 3 处匹配')
    assert.ok(await page.locator('.cm-searchMatch').count() >= 3)
    await button('下一个').click()
    await checkStatus('2 / 3 处匹配')
    await button('上一个').click()
    await checkStatus('1 / 3 处匹配')
    await search.press('Shift+Enter')
    await checkStatus('3 / 3 处匹配')
    await search.press('Enter')
    await checkStatus('1 / 3 处匹配')
    await page.getByRole('checkbox', { name: '区分大小写' }).check()
    await checkStatus('1 / 1 处匹配')
    await replacement.fill('beta')
    await button('替换当前').click()
    assert.equal(await text(), original.replace('alpha', 'beta'))
    await button('撤销').click()
    assert.equal(await text(), original)
    await button('重做').click()
    assert.equal(await text(), original.replace('alpha', 'beta'))
    await button('撤销').click()
    await page.getByRole('checkbox', { name: '区分大小写' }).uncheck()
    await button('全部替换').click()
    assert.equal(await text(), original.replace(/alpha/gi, 'beta'))
    await button('撤销').click()
    assert.equal(await text(), original)
    await mark('plain search, navigation, replacement, undo and redo')

    await page.getByRole('checkbox', { name: '正则表达式' }).check()
    await search.fill('item-(\\d+)')
    await replacement.fill('编号[$1]\\n')
    await checkStatus('1 / 2 处匹配')
    await button('全部替换').click()
    assert.equal(await text(), original.replace(/item-(\d+)/g, '编号[$1]\n'))
    await button('撤销').click()
    assert.equal(await text(), original)
    await search.fill('[')
    await checkStatus('正则表达式无效')
    assert.equal(await search.getAttribute('aria-invalid'), 'true')
    assert.ok(await button('全部替换').isDisabled())
    assert.equal(await text(), original)
    await mark('regex groups, newlines, invalid expression')
    await search.fill('never-matches')
    await checkStatus('没有匹配结果')
    await search.fill('item-\\d+')
    await replacement.fill('')
    await button('全部替换').click()
    assert.equal(await text(), original.replace(/item-\d+/g, ''))
    await button('撤销').click()

    // Zero-width searches must move between lines and support replace-all without a loop.
    await search.fill('^')
    await checkStatus('1 / 4 处匹配')
    await button('下一个').click()
    await checkStatus('2 / 4 处匹配')
    await replacement.fill('> ')
    await button('全部替换').click()
    assert.equal(await text(), original.replace(/^/gm, '> '))
    await button('撤销').click()
    await mark('empty replacements and zero-width regex')

    await search.fill('')
    await content.focus()
    await content.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f')
    assert.ok(await search.evaluate((element) => element === document.activeElement))
    await search.press('Escape')
    assert.ok(await content.evaluate((element) => element === document.activeElement))
    await button('清空文本').click()
    assert.equal(await text(), '')
    await button('撤销').click()
    assert.equal(await text(), original)
    await page.evaluate(() => { window.__denyClipboard = true })
    await button('复制全文').click()
    await page.getByText('无法访问剪贴板，请在编辑区全选后手动复制。', { exact: true }).waitFor()
    await page.evaluate(() => { window.__denyClipboard = false })
    await button('复制全文').click()
    await mark('keyboard shortcuts, reversible clear, clipboard failure')

    await search.fill('item-(\\d+)')
    await replacement.fill('编号 $1')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: path.join(outputDir, `${theme}-${width}.png`), fullPage: true })

    if (width === Math.max(...widths) && theme === 'light') {
      await search.fill('')
      const large = Array.from({ length: 12000 }, (_, index) => `第 ${index + 1} 行 ${'长文本内容 '.repeat(12)}`).join('\n')
      await setText(large)
      assert.equal(await text(), large)
      await search.fill('第 12000 行')
      await checkStatus('1 / 1 处匹配')
      await replacement.fill('最后一行')
      await button('替换当前').click()
      assert.equal(await text(), large.replace('第 12000 行', '最后一行'))
      await page.getByRole('checkbox', { name: '自动换行' }).uncheck()
      await mark('large document and non-wrapping lines')
    }

    await search.fill('')
    const marker = 'PRIVATE_TEXT_EDITOR_7e504d'
    const requests = []
    const onRequest = (request) => requests.push(`${request.method()} ${request.url()} ${request.postData() || ''}`)
    context.on('request', onRequest)
    await setText(marker)
    await search.fill(marker)
    await replacement.fill(`${marker}-replacement`)
    await button('全部替换').click()
    assert.equal(await text(), `${marker}-replacement`)
    assert.deepEqual(await page.evaluate(() => window.__storageWrites), [])
    const storage = await context.storageState({ indexedDB: true })
    assert.ok(!JSON.stringify(storage).includes(marker))
    assert.ok(!requests.some((request) => request.includes(marker)))
    context.off('request', onRequest)
    await page.reload()
    await search.waitFor()
    assert.equal(await text(), '')
    assert.equal(await search.inputValue(), '')
    assert.equal(await replacement.inputValue(), '')
    assert.ok(await button('撤销').isDisabled())
    await content.fill(marker)
    await page.evaluate(() => { location.hash = '/' })
    await page.locator('.tool-tile').filter({ hasText: '在线文本编辑器' }).click()
    await search.waitFor()
    assert.equal(await text(), '')
    assert.ok(await button('撤销').isDisabled())
    await context.setOffline(true)
    // Playwright WebKit fails offline navigation internally; still test editing while offline.
    if (browserName !== 'webkit') await page.reload()
    await search.waitFor()
    await content.fill('离线编辑 123')
    await search.fill('123')
    await replacement.fill('456')
    await button('全部替换').click()
    assert.equal(await text(), '离线编辑 456')
    await mark('no storage or upload, reload/navigation cleanup, offline operation')
    await context.close()
    console.log(`${browserName} ${theme} ${width}: passed`)
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ browserName, checks, errors }, null, 2))
}
console.log(`${checks.length} text editor checks passed`)
