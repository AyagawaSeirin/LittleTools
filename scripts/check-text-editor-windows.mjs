import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const browser = await playwright[browserName].launch({ ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) })
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-editor-windows', browserName)
const report = { browserName, checks: [], errors: [] }
await mkdir(outputDir, { recursive: true })
const editor = (page) => page.getByRole('textbox', { name: '文本编辑区', exact: true })
const search = (page) => page.getByRole('textbox', { name: '搜索文本', exact: true })
const replacement = (page) => page.getByRole('textbox', { name: '替换文本', exact: true })
const button = (page, name) => page.getByRole('button', { name, exact: true })
const copiedText = async (page) => {
  await button(page, '复制全文').click()
  return page.evaluate(() => window.__copiedText)
}

try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript(() => {
      window.__storageWrites = []
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        window.__storageWrites.push([key, value])
        return setItem.call(this, key, value)
      }
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => { window.__copiedText = text } } })
    })
    context.on('page', (page) => page.on('pageerror', (error) => report.errors.push({ theme, state: report.checks.at(-1)?.state, error: error.message })))
    const warmup = await context.newPage()
    await warmup.goto(baseUrl)
    await warmup.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await warmup.waitForTimeout(250)
    await warmup.close()
    const page = await context.newPage()
    await page.goto(`${baseUrl}/#/text-editor`)
    await editor(page).waitFor()
    const marker = 'PRIVATE_EDITOR_WINDOW_你好 123'
    await editor(page).fill(marker)
    await page.getByRole('checkbox', { name: '正则表达式' }).check()
    await search(page).fill('(\\d+)')
    await replacement(page).fill('[$1]')
    await page.evaluate(() => { window.__storageWrites = [] })
    const requests = []
    context.on('request', (request) => requests.push(`${request.url()} ${request.postData() || ''}`))
    const canPin = await page.locator('.window-launch').getAttribute('aria-label') === '置顶窗口'
    assert.equal(await page.locator('.window-launch').count(), 1)
    assert.equal(await button(page, '独立窗口').count(), 0)
    const kinds = canPin ? ['pip', 'popup'] : ['popup']
    if (!canPin) {
      await page.getByText('当前浏览器不支持置顶，编辑窗口会以普通窗口打开。', { exact: true }).waitFor()
      report.checks.push({ theme, state: 'unsupported PiP offers ordinary window' })
    }

    const switchPin = async (current, pinned, fromMain = false) => {
      const next = context.waitForEvent('page')
      await button(fromMain ? page : current, pinned ? '置顶' : '取消置顶').click({ noWaitAfter: true })
        .catch((error) => { if (!current.isClosed()) throw error })
      const child = await next
      await editor(child).waitFor()
      assert.ok(current.isClosed(), 'The previous native window must close after the transfer')
      assert.equal(await page.locator('.cm-editor').count(), 0)
      assert.equal(await child.locator('.pin-toggle').getAttribute('aria-pressed'), String(pinned))
      return child
    }

    const open = async (kind) => {
      const pending = context.waitForEvent('page')
      await page.locator('.window-launch').click()
      let child = await pending
      await editor(child).waitFor()
      if (kind === 'popup' && canPin) child = await switchPin(child, false)
      return child
    }

    for (const kind of kinds) {
      await search(page).fill('')
      await search(page).fill('(\\d+)')
      const child = await open(kind)
      assert.equal(await child.evaluate(() => document.compatMode), 'CSS1Compat')
      assert.equal(await page.locator('.cm-content').count(), 0)
      assert.equal(await child.locator('.app-sider').count(), 0)
      assert.equal(await child.title(), '在线文本编辑器 · LittleTools')
      assert.equal(await child.evaluate(() => Boolean(document.fullscreenElement)), false)
      await child.waitForFunction(() => getSelection().toString() === '123')
      assert.equal(await search(child).inputValue(), '(\\d+)')
      assert.equal(await replacement(child).inputValue(), '[$1]')
      assert.equal(await copiedText(child), marker)
      assert.equal(await child.locator('html').getAttribute('data-theme'), theme)
      assert.deepEqual(await child.evaluate(() => window.__storageWrites), [])
      if (kind === 'pip') {
        assert.equal(await page.evaluate(() => documentPictureInPicture.window?.document.querySelectorAll('.cm-editor').length), 1)
        assert.equal(await button(child, '全屏编辑').count(), 0)
      } else if (await button(child, '全屏编辑').count()) {
        await button(child, '全屏编辑').click()
        await child.waitForFunction(() => document.fullscreenElement?.classList.contains('editor-shell'))
        await button(child, '退出全屏').click()
        await child.waitForFunction(() => !document.fullscreenElement)
      }
      report.checks.push({ theme, kind, state: 'native window, preserved selection/query and optional fullscreen' })

      await button(child, '替换当前').click()
      assert.equal(await copiedText(child), marker.replace('123', '[123]'))
      await button(child, '撤销').click()
      assert.equal(await copiedText(child), marker)
      await editor(child).focus()
      await editor(child).press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
      await editor(child).press('!')
      assert.equal(await copiedText(child), `${marker}!`)

      await button(page, theme === 'dark' ? '切换为白天模式' : '切换为黑夜模式').click()
      await child.waitForFunction((value) => document.documentElement.dataset.theme === value, theme === 'dark' ? 'light' : 'dark')
      const bodyColor = await child.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor)
      assert.equal(bodyColor, theme === 'dark' ? 'rgb(243, 245, 242)' : 'rgb(17, 21, 19)')
      await button(page, theme === 'dark' ? '切换为黑夜模式' : '切换为白天模式').click()
      await child.waitForFunction((value) => document.documentElement.dataset.theme === value, theme)
      report.checks.push({ theme, kind, state: 'editing, replacement, undo and theme synchronization' })

      for (const [width, height] of [[800, 640], [480, 420], [320, 680]]) {
        await child.setViewportSize({ width, height })
        await child.locator('.editor-status').scrollIntoViewIfNeeded()
        assert.ok(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        assert.ok((await child.locator('.text-editor').boundingBox()).height >= 180)
        const editorBox = await child.locator('.text-editor').boundingBox()
        const scrollerBox = await child.locator('.cm-scroller').boundingBox()
        assert.ok(scrollerBox.height >= 180, 'Search controls must leave a usable editing area')
        assert.ok(scrollerBox.y + scrollerBox.height <= editorBox.y + editorBox.height + 1, 'The editing area must not be clipped')
        await child.evaluate(() => window.scrollTo(0, 0))
        await child.locator('.editor-shell').evaluate((element) => { element.scrollTop = 0 })
        await child.screenshot({ path: path.join(outputDir, `${kind}-${theme}-${width}.png`), fullPage: true })
      }
      report.checks.push({ theme, kind, state: 'resizable layouts without horizontal overflow' })

      if (kind === 'pip') await child.close()
      else await button(child, '返回原页面').click({ noWaitAfter: true }).catch((error) => { if (!child.isClosed()) throw error })
      await editor(page).waitFor()
      assert.equal(await copiedText(page), `${marker}!`)
      assert.equal(await search(page).inputValue(), '(\\d+)')
      await button(page, '撤销').click()
      assert.equal(await copiedText(page), marker)
      assert.equal(await page.locator('.cm-editor').count(), 1)
      // Theme preferences are intentionally persistent; editing data is not.
      const writes = await page.evaluate(() => window.__storageWrites.filter(([key]) => !['little-tools-mode', 'little-tools-color'].includes(key)))
      assert.deepEqual(writes, [])
      assert.ok(!JSON.stringify(await context.storageState({ indexedDB: true })).includes(marker))
      assert.ok(!requests.some((request) => request.includes(marker)))
      report.checks.push({ theme, kind, state: 'return/close keeps undo history with no text persistence or upload' })
    }

    // Pin/unpin the same editor repeatedly; no document or EditorView recreation is allowed.
    if (canPin) {
      await page.getByRole('combobox', { name: '语法高亮语言', exact: true }).selectOption('JavaScript')
      await page.locator('.cm-content [class*="text-syntax-"]').first().waitFor()
      await search(page).fill('')
      await search(page).fill('(\\d+)')
      let child = await open('pip')
      await editor(child).evaluate((element) => { element.__editorIdentity = 'same-editor' })
      const assertSession = async (window) => {
        assert.equal(await editor(window).evaluate((element) => element.__editorIdentity), 'same-editor')
        assert.equal(await search(window).inputValue(), '(\\d+)')
        assert.equal(await replacement(window).inputValue(), '[$1]')
        assert.equal(await window.getByRole('combobox', { name: '语法高亮语言', exact: true }).inputValue(), 'JavaScript')
        assert.equal(await copiedText(window), marker)
      }
      child = await switchPin(child, false)
      await assertSession(child)
      assert.equal(await button(child, '全屏编辑').count(), 1)
      assert.equal(await button(child, '独立窗口').count(), 0)
      // Return-to-opener activation must not depend on a recent click in the main page.
      // Do not evaluate in the main page before the child click: Playwright evaluation activates it.
      await child.waitForTimeout(6100)
      await button(child, '置顶').click()
      await page.locator('.pin-confirmation').waitFor()
      child = await switchPin(child, true, true)
      await assertSession(child)
      child = await switchPin(child, false)
      await assertSession(child)
      child = await switchPin(child, true, true)
      await assertSession(child)
      await button(child, '替换当前').click()
      assert.equal(await copiedText(child), marker.replace('123', '[123]'))
      child = await switchPin(child, false)
      await button(child, '撤销').click()
      assert.equal(await copiedText(child), marker)
      await button(child, '重做').click()
      assert.equal(await copiedText(child), marker.replace('123', '[123]'))
      await button(child, '撤销').click()
      child = await switchPin(child, true, true)
      await assertSession(child)
      report.checks.push({ theme, state: 'repeated pin/unpin preserves the same DOM, source, query, language and activation fallback' })

      // If unpinning is blocked, the pinned editor must stay alive.
      await page.evaluate(() => { window.__originalOpen = window.open; window.open = () => null })
      await button(child, '取消置顶').click()
      await child.getByText('新窗口被浏览器拦截，请允许本站弹出窗口后重试。当前窗口和编辑内容已保留。', { exact: true }).waitFor()
      assert.ok(!child.isClosed())
      await assertSession(child)
      assert.equal(await child.locator('.pin-toggle').getAttribute('aria-pressed'), 'true')
      await page.evaluate(() => { window.open = window.__originalOpen })

      // Also roll back a failure after the DOM was adopted by the destination document.
      await page.evaluate(() => {
        const original = window.open
        window.open = (...args) => {
          const candidate = original.apply(window, args)
          const write = candidate.document.write.bind(candidate.document)
          candidate.document.write = (...parts) => {
            write(...parts)
            const append = candidate.document.body.append.bind(candidate.document.body)
            candidate.document.body.append = (...nodes) => { append(...nodes); throw new Error('Simulated adoption failure') }
          }
          return candidate
        }
      })
      await button(child, '取消置顶').click()
      await child.getByText('窗口切换失败，原窗口和编辑内容已保留，请重试。', { exact: true }).waitFor()
      await assertSession(child)
      await page.evaluate(() => { window.open = window.__originalOpen })
      child = await switchPin(child, false)
      await assertSession(child)
      await page.evaluate(() => {
        window.__originalRequest = documentPictureInPicture.requestWindow
        documentPictureInPicture.requestWindow = async () => { throw new DOMException('Denied', 'NotAllowedError') }
      })
      await button(page, '置顶').click()
      await child.getByText('浏览器未允许置顶，当前窗口和编辑内容已保留。', { exact: true }).waitFor()
      await assertSession(child)
      assert.equal(await child.locator('.pin-toggle').getAttribute('aria-pressed'), 'false')
      await page.evaluate(() => { documentPictureInPicture.requestWindow = window.__originalRequest })
      report.checks.push({ theme, state: 'blocked popup, failed adoption and rejected pin preserve the original editing session' })

      // Cancel a delayed pin request by returning to the main page.
      await page.evaluate(() => {
        documentPictureInPicture.requestWindow = function (options) {
          const result = window.__originalRequest.call(this, options)
          return result.then((child) => new Promise((resolve) => { window.__finishPin = () => resolve(child) }))
        }
      })
      const pendingCandidate = context.waitForEvent('page')
      await button(page, '置顶').click()
      const candidate = await pendingCandidate
      await page.waitForFunction(() => typeof window.__finishPin === 'function')
      await button(page, '返回此页编辑').click()
      await page.evaluate(() => { window.__finishPin(); documentPictureInPicture.requestWindow = window.__originalRequest })
      await editor(page).waitFor()
      await page.waitForFunction(() => !documentPictureInPicture.window || documentPictureInPicture.window.closed)
      assert.ok(candidate.isClosed())
      assert.ok(child.isClosed())
      assert.equal(await copiedText(page), marker)
      assert.equal(await editor(page).evaluate((element) => element.__editorIdentity), 'same-editor')
      report.checks.push({ theme, state: 'returning during a pending pin closes the late window and retains the editor' })

      const rejectingSource = await open('popup')
      await page.evaluate(() => {
        documentPictureInPicture.requestWindow = () => new Promise((_resolve, reject) => { window.__rejectPin = reject })
      })
      await button(page, '置顶').click()
      await page.waitForFunction(() => typeof window.__rejectPin === 'function')
      await button(page, '返回此页编辑').click()
      await page.evaluate(() => {
        window.__rejectPin(new DOMException('Cancelled', 'NotAllowedError'))
        documentPictureInPicture.requestWindow = window.__originalRequest
      })
      await page.waitForTimeout(100)
      await editor(page).waitFor()
      assert.ok(rejectingSource.isClosed())
      assert.equal(await copiedText(page), marker)
      assert.equal(await editor(page).evaluate((element) => element.__editorIdentity), 'same-editor')
      report.checks.push({ theme, state: 'late request rejection cannot move the editor back into a closed window' })
    } else {
      await page.evaluate(() => { window.__originalOpen = window.open; window.open = () => null })
      await page.locator('.window-launch').click()
      await page.getByText('新窗口被浏览器拦截，请允许本站弹出窗口后重试。当前窗口和编辑内容已保留。', { exact: true }).waitFor()
      assert.equal(await copiedText(page), marker)
      await page.evaluate(() => { window.open = window.__originalOpen })
      report.checks.push({ theme, state: 'unsupported PiP and blocked fallback preserve the editor' })
    }

    const routeChild = await open(kinds.at(-1))
    await page.evaluate(() => { location.hash = '/' })
    await page.locator('.home-hero').waitFor()
    await page.waitForFunction(() => document.querySelector('.cm-editor') === null)
    assert.ok(routeChild.isClosed())
    await page.locator('.tool-tile').filter({ hasText: '在线文本编辑器' }).click()
    await editor(page).waitFor()
    assert.ok(await button(page, '复制全文').isDisabled())
    assert.equal(await search(page).inputValue(), '')

    const reloadChild = await open('popup')
    await page.reload()
    await editor(page).waitFor()
    assert.ok(reloadChild.isClosed())
    assert.ok(await button(page, '复制全文').isDisabled())
    const closeChild = await open('popup')
    const closed = closeChild.waitForEvent('close')
    await page.close({ runBeforeUnload: true })
    await closed
    report.checks.push({ theme, state: 'route change, reload and opener closure clean up child windows and text' })
    await context.close()
    console.log(`${browserName} ${theme}: window checks passed (PiP ${canPin ? 'supported' : 'unavailable'})`)
  }
  assert.deepEqual(report.errors, [])
} finally {
  await browser.close()
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
}
console.log(`${report.checks.length} editor window checks passed`)
