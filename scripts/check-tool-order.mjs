import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectLayout } from './responsive-layout.mjs'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const browser = await playwright[browserName].launch()
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-tool-order', browserName)
const storageKey = 'little-tools:v1:tool-order'
const errors = []
let stage = 'desktop sorting'
const recordError = (error) => errors.push({ stage, message: error.message })
await mkdir(outputDir, { recursive: true })

async function warmCache(context) {
  const warmup = await context.newPage()
  await warmup.goto(baseUrl)
  await warmup.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await warmup.waitForTimeout(250)
  await warmup.close()
}

const getOrder = (page, selector = '.tool-grid') => page.locator(`${selector} > [data-tool-key]`).evaluateAll((items) => items.map((item) => item.dataset.toolKey))
const waitOrder = (page, expected, selector = '.tool-grid') => page.waitForFunction(({ expected, selector }) => {
  const keys = [...document.querySelectorAll(`${selector} > [data-tool-key]`)].map((item) => item.dataset.toolKey)
  return JSON.stringify(keys) === JSON.stringify(expected)
}, { expected, selector }).catch(async (error) => {
  console.error({ selector, expected, actual: await getOrder(page, selector) })
  await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true })
  throw error
})

async function drag(page, selector, sourceKey, targetKey) {
  const handle = page.locator(`${selector} > [data-tool-key="${sourceKey}"] .tool-drag-handle`)
  await handle.scrollIntoViewIfNeeded()
  const source = await handle.boundingBox()
  const target = await page.locator(`${selector} > [data-tool-key="${targetKey}"]`).boundingBox()
  const x = source.x + source.width / 2, y = source.y + source.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 8, y + 8)
  await page.waitForTimeout(100)
  await page.mouse.move(target.x + target.width / 2, target.y + target.height * (target.y < y ? .25 : .75), { steps: 20 })
  await page.waitForTimeout(300)
  await page.mouse.up()
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await warmCache(context)
  let page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', recordError)
  await page.goto(baseUrl)
  await page.locator('.tool-tile').first().waitFor()
  const defaults = await getOrder(page)
  assert.equal(defaults.length, 15)
  assert.equal(await page.getByRole('button', { name: '恢复默认顺序' }).isDisabled(), true)
  await waitOrder(page, defaults, '.side-menu .ant-menu')

  await drag(page, '.tool-grid', defaults[0], defaults[3])
  const firstMove = [...defaults.slice(1, 4), defaults[0], ...defaults.slice(4)]
  await waitOrder(page, firstMove)
  await waitOrder(page, firstMove, '.side-menu .ant-menu')
  assert.ok(page.url().endsWith('/'))
  assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey), firstMove)

  await drag(page, '.side-menu .ant-menu', defaults[0], defaults[1])
  await waitOrder(page, defaults)
  await waitOrder(page, defaults, '.side-menu .ant-menu')
  const handle = page.locator(`.tool-grid [data-tool-key="${defaults[0]}"] .tool-drag-handle`)
  await handle.focus()
  await handle.press('End')
  const lastMove = [...defaults.slice(1), defaults[0]]
  await waitOrder(page, lastMove)
  assert.equal(await handle.evaluate((element) => element === document.activeElement), true)
  await handle.press('ArrowUp')
  const keyboardMove = [...defaults.slice(1, -1), defaults[0], defaults.at(-1)]
  await waitOrder(page, keyboardMove)
  await page.reload()
  await waitOrder(page, keyboardMove)
  await waitOrder(page, keyboardMove, '.side-menu .ant-menu')

  const otherTab = await context.newPage()
  await otherTab.goto(baseUrl)
  await waitOrder(otherTab, keyboardMove)
  await otherTab.getByRole('button', { name: '恢复默认顺序' }).click()
  await waitOrder(page, defaults)
  await otherTab.close()
  await page.locator(`.tool-grid [data-tool-key="${defaults[2]}"] .tool-drag-handle`).press('Home')
  const persisted = [defaults[2], ...defaults.filter((key) => key !== defaults[2])]
  await page.close()
  page = await context.newPage()
  page.on('pageerror', recordError)
  await page.goto(baseUrl)
  await waitOrder(page, persisted)
  await page.locator('.tool-tile-link').filter({ hasText: '随机密码生成' }).click()
  await page.waitForURL('**/#/password')
  await waitOrder(page, persisted, '.side-menu .ant-menu')
  await page.getByRole('menuitem', { name: '工具首页', exact: true }).click()
  await waitOrder(page, persisted)

  // Exercise the write-failure UI without blocking unrelated application settings.
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return original.call(this, name, value)
    }
  }, storageKey)
  await page.locator('.tool-grid .tool-drag-handle').first().press('ArrowDown')
  await page.getByRole('alert').filter({ hasText: '浏览器未能保存工具顺序' }).waitFor()
  await page.reload()
  await waitOrder(page, persisted)
  await page.getByRole('button', { name: '恢复默认顺序' }).click()

  for (const width of [320, 390, 768, 1440]) {
    stage = `desktop layout at ${width}px`
    const layoutPage = await context.newPage()
    layoutPage.on('pageerror', recordError)
    await layoutPage.setViewportSize({ width, height: 900 })
    await layoutPage.goto(baseUrl)
    await waitOrder(layoutPage, defaults)
    for (const theme of ['light', 'dark']) {
      if (await layoutPage.evaluate(() => document.documentElement.dataset.theme) !== theme) {
        await layoutPage.getByRole('button', { name: theme === 'dark' ? '切换为黑夜模式' : '切换为白天模式', exact: true }).click()
      }
      await layoutPage.waitForTimeout(100)
      assert.deepEqual(await layoutPage.evaluate(inspectLayout), [], `layout: ${width}, ${theme}`)
    }
    if (width === 1440) await layoutPage.screenshot({ path: path.join(outputDir, 'desktop.png'), fullPage: true })
    await layoutPage.close()
  }
  await context.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: browserName !== 'firefox', reducedMotion: 'reduce' })
  stage = 'mobile sorting'
  await warmCache(mobile)
  page = await mobile.newPage()
  page.on('pageerror', recordError)
  await page.goto(baseUrl)
  await waitOrder(page, defaults)
  if (browserName === 'chromium') {
    const client = await mobile.newCDPSession(page)
    const source = await page.locator('.tool-grid .tool-drag-handle').first().boundingBox()
    const target = await page.locator('.tool-tile').nth(2).boundingBox()
    const x = source.x + source.width / 2, y = source.y + source.height / 2
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 15; step++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (target.y + target.height * .75 - y) * step / 15 }] })
      await page.waitForTimeout(30)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const touchMove = [...defaults.slice(1, 3), defaults[0], ...defaults.slice(3)]
    await waitOrder(page, touchMove)
    await page.reload()
    await waitOrder(page, touchMove)
  }
  const mobileOrder = await getOrder(page)
  await page.screenshot({ path: path.join(outputDir, 'mobile-home.png') })
  await page.getByRole('button', { name: '打开菜单', exact: true }).click()
  await waitOrder(page, mobileOrder, '.mobile-drawer .ant-menu')
  await drag(page, '.mobile-drawer .ant-menu', mobileOrder[0], mobileOrder[2])
  const drawerMove = [...mobileOrder.slice(1, 3), mobileOrder[0], ...mobileOrder.slice(3)]
  await waitOrder(page, drawerMove, '.mobile-drawer .ant-menu')
  await waitOrder(page, drawerMove)
  assert.deepEqual(await page.evaluate(inspectLayout), [], 'mobile drawer layout')
  await page.screenshot({ path: path.join(outputDir, 'mobile-drawer.png') })
  stage = 'mobile navigation to date calculator'
  await page.getByRole('menuitem').filter({ hasText: '日期计算' }).last().click()
  await page.waitForURL('**/#/date-calculator')
  await page.locator('.mobile-drawer').waitFor({ state: 'hidden' })
  await mobile.close()
  assert.deepEqual(errors, [], 'browser errors')
  console.log(`${browserName}: drag, navigation, keyboard, persistence, cross-tab sync, storage failure and responsive layout passed. Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
