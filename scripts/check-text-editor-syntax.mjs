import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectLayout } from './responsive-layout.mjs'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const browser = await playwright[browserName].launch({ ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) })
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-editor-syntax', browserName)
const examples = JSON.parse(await readFile(new URL('../src/__tests__/fixtures/textSyntax.json', import.meta.url), 'utf8'))
const report = { browserName, checks: [], errors: [], limitations: [] }
await mkdir(outputDir, { recursive: true })
const editor = (page) => page.getByRole('textbox', { name: '文本编辑区', exact: true })
const language = (page) => page.getByRole('combobox', { name: '语法高亮语言', exact: true })
const button = (page, name) => page.getByRole('button', { name, exact: true })
const tokens = (page) => page.locator('.cm-content [class*="text-syntax-"]')
const copiedText = async (page) => {
  await button(page, '复制全文').click()
  return page.evaluate(() => window.__copiedText)
}
const choose = async (page, name) => {
  await language(page).selectOption(name)
  await page.waitForFunction(() => document.querySelector('#editor-language')?.getAttribute('aria-busy') === 'false')
  if (name === 'plain') assert.equal(await tokens(page).count(), 0)
  else await tokens(page).first().waitFor()
}
const installFixtures = () => {
  window.__storageWrites = []
  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    window.__storageWrites.push([key, value])
    return setItem.call(this, key, value)
  }
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => { window.__copiedText = text } } })
}

try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript(installFixtures)
    context.on('page', (page) => page.on('pageerror', (error) => report.errors.push({ theme, error: error.message })))
    const warmup = await context.newPage()
    await warmup.goto(baseUrl)
    await warmup.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await warmup.waitForTimeout(250)
    await warmup.close()
    const page = await context.newPage()
    await page.goto(`${baseUrl}/#/text-editor`)
    await language(page).waitFor()
    await page.evaluate(() => { window.__storageWrites = [] })
    assert.equal(await language(page).inputValue(), 'plain')
    assert.equal(await language(page).locator('option').count(), 144)
    const requests = []
    context.on('request', (request) => requests.push(`${request.url()} ${request.postData() || ''}`))

    for (const example of examples) {
      await choose(page, 'plain')
      await editor(page).fill(example.source)
      await choose(page, example.language)
      assert.equal(await copiedText(page), example.source)
      const color = await tokens(page).first().evaluate((element) => getComputedStyle(element).color)
      const foreground = await editor(page).evaluate((element) => getComputedStyle(element).color)
      assert.notEqual(color, foreground, `${example.language}: highlighting must be visibly colored`)
      assert.deepEqual(await page.evaluate(inspectLayout), [])
      report.checks.push({ theme, language: example.language, state: 'colored syntax and unchanged source' })
    }

    const marker = '// PRIVATE_SYNTAX_7b289\nconst name = "你好 🌏";\nconsole.log(name, 42);'
    await choose(page, 'plain')
    await editor(page).fill(marker)
    await choose(page, 'JavaScript')
    const keyword = page.locator('.cm-content .text-syntax-keyword').first()
    const colorBefore = await keyword.evaluate((element) => getComputedStyle(element).color)
    await button(page, theme === 'dark' ? '切换为白天模式' : '切换为黑夜模式').click()
    await page.waitForFunction((before) => getComputedStyle(document.querySelector('.text-syntax-keyword')).color !== before, colorBefore)
    await button(page, theme === 'dark' ? '切换为黑夜模式' : '切换为白天模式').click()
    await page.waitForFunction((before) => getComputedStyle(document.querySelector('.text-syntax-keyword')).color === before, colorBefore)
    await page.getByRole('textbox', { name: '搜索文本', exact: true }).fill('name')
    await page.getByRole('textbox', { name: '替换文本', exact: true }).fill('person')
    assert.equal(await page.locator('.search-status').innerText(), '1 / 2 处匹配')
    await button(page, '全部替换').click()
    assert.equal(await copiedText(page), marker.replaceAll('name', 'person'))
    await choose(page, 'Python')
    await button(page, '撤销').click()
    assert.equal(await copiedText(page), marker)
    assert.equal(await language(page).inputValue(), 'Python')
    await button(page, '重做').click()
    assert.equal(await copiedText(page), marker.replaceAll('name', 'person'))
    await choose(page, 'plain')
    await page.getByRole('textbox', { name: '搜索文本', exact: true }).fill('person')
    assert.ok(await page.locator('.cm-searchMatch').count() > 0)
    await choose(page, 'JavaScript')
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.deepEqual(await page.evaluate(inspectLayout), [])
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(outputDir, `${theme}-${width}.png`), fullPage: true })
    }
    report.checks.push({ theme, state: 'theme switching, search highlights, replacement, undo/redo, plain text and responsive layout' })

    const canPin = await page.locator('.window-launch').getAttribute('aria-label') === '置顶窗口'
    const kinds = canPin ? ['pip', 'popup'] : ['popup']
    for (const kind of kinds) {
      const pending = context.waitForEvent('page')
      await page.locator('.window-launch').click()
      let child = await pending
      if (kind === 'popup' && canPin) {
        const next = context.waitForEvent('page')
        const previous = child
        await button(previous, '取消置顶').click({ noWaitAfter: true }).catch((error) => { if (!previous.isClosed()) throw error })
        child = await next
      }
      await tokens(child).first().waitFor()
      await child.setViewportSize({ width: 800, height: 640 })
      assert.equal(await language(child).inputValue(), 'JavaScript')
      assert.equal(await copiedText(child), marker.replaceAll('name', 'person'))
      await choose(child, 'Python')
      await choose(child, 'JavaScript')
      assert.equal(await child.locator('.text-syntax-keyword').first().evaluate((element) => getComputedStyle(element).color), colorBefore)
      await child.screenshot({ path: path.join(outputDir, `${theme}-${kind}.png`) })
      await child.close()
      await tokens(page).first().waitFor()
      assert.equal(await language(page).inputValue(), 'JavaScript')
      assert.equal(await copiedText(page), marker.replaceAll('name', 'person'))
      report.checks.push({ theme, kind, state: 'language selection and syntax colors survive detached windows' })
    }

    assert.deepEqual(await page.evaluate(() => window.__storageWrites.filter(([key]) => !['little-tools-mode', 'little-tools-color'].includes(key))), [])
    assert.ok(!JSON.stringify(await context.storageState({ indexedDB: true })).includes('PRIVATE_SYNTAX_7b289'))
    assert.ok(!requests.some((request) => request.includes('PRIVATE_SYNTAX_7b289')))
    await page.getByRole('textbox', { name: '搜索文本', exact: true }).fill('')
    await editor(page).fill('<script>window.__syntaxExecuted = true</script><b>safe</b>')
    await choose(page, 'HTML')
    assert.equal(await editor(page).locator('script, b').count(), 0)
    assert.equal(await page.evaluate(() => window.__syntaxExecuted), undefined)
    await choose(page, 'plain')
    await editor(page).fill('let message = "offline"')
    const offlineFailures = []
    page.on('requestfailed', (request) => offlineFailures.push(request.failure()?.errorText || ''))
    await context.setOffline(true)
    // OCaml wasn't imported above; this checks the precached lazy language bundle.
    await language(page).selectOption('OCaml')
    await page.waitForFunction(() => document.querySelector('#editor-language')?.getAttribute('aria-busy') === 'false')
    if (browserName === 'webkit' && await page.locator('.language-error').count()) {
      assert.ok(offlineFailures.includes('WebKit encountered an internal error'))
      report.limitations.push({ theme, note: 'Playwright WebKit rejects offline imports of not-yet-loaded modules even when precached; validated already-loaded Python offline instead.' })
      await choose(page, 'Python')
    } else await tokens(page).first().waitFor()
    assert.equal(await copiedText(page), 'let message = "offline"')
    await context.setOffline(false)
    await page.reload()
    await language(page).waitFor()
    assert.equal(await language(page).inputValue(), 'plain')
    assert.ok(await button(page, '复制全文').isDisabled())
    report.checks.push({ theme, state: 'no persistence/upload/execution, offline language loading and reload cleanup' })
    await context.close()
    console.log(`${browserName} ${theme}: syntax checks passed`)
  }

  if (browserName === 'chromium') {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    await context.addInitScript(installFixtures)
    // A browser without Service Workers lets us test actual lazy-import network failures.
    await context.addInitScript(() => { delete Navigator.prototype.serviceWorker })
    const page = await context.newPage()
    page.on('pageerror', (error) => report.errors.push({ state: 'lazy loading failures', error: error.message }))
    await page.goto(`${baseUrl}/#/text-editor`)
    const source = 'my $name = "Ada";'
    await editor(page).fill(source)
    await context.route('**/assets/perl-*.js', (route) => route.abort())
    await language(page).selectOption('Perl')
    await page.getByText('Perl 高亮加载失败，暂按纯文本显示。可切换语言，或复制文本后刷新页面再试。', { exact: true }).waitFor()
    assert.equal(await copiedText(page), source)
    assert.equal(await tokens(page).count(), 0)
    await context.unroute('**/assets/perl-*.js')
    // Failed native imports may be cached by the browser until reload. Another language works.
    await choose(page, 'Python')
    assert.equal(await copiedText(page), source)

    let release, requested
    const gate = new Promise((resolve) => { release = resolve })
    const started = new Promise((resolve) => { requested = resolve })
    await context.route('**/assets/haskell-*.js', async (route) => { requested(); await gate; await route.continue() })
    await language(page).selectOption('Haskell')
    await started
    await choose(page, 'plain')
    const finished = page.waitForEvent('requestfinished', (request) => /\/haskell-.*\.js$/.test(request.url()))
    release()
    await finished
    await page.waitForTimeout(150)
    assert.equal(await tokens(page).count(), 0)
    assert.equal(await language(page).inputValue(), 'plain')
    assert.equal(await copiedText(page), source)
    report.checks.push({ state: 'failed language load preserves text, another language works, stale asynchronous load ignored' })
    await context.close()
  }
  assert.deepEqual(report.errors, [])
} finally {
  await browser.close()
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
}
console.log(`${report.checks.length} syntax highlighting checks passed`)
