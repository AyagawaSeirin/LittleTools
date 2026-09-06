import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const browser = await playwright[browserName].launch({ ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) })
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-popups', browserName)
const checks = []
await mkdir(outputDir, { recursive: true })
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: theme })
    const page = await context.newPage()
    await page.goto(baseUrl)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await page.waitForTimeout(250)
    for (const route of ['date-calculator', 'timestamp']) {
      await page.goto(`${baseUrl}/#/${route}`)
      await page.getByRole('heading', { name: route === 'timestamp' ? '时间戳转换' : '日期计算器', exact: true }).waitFor()
      await page.locator('.ant-picker input').first().waitFor()
      for (const [width, height] of [[320, 568], [375, 667], [390, 844], [568, 320], [667, 375], [896, 414], [1024, 768]]) {
        await page.setViewportSize({ width, height })
        await page.locator('.ant-picker input').first().click()
        const panel = page.locator('.ant-picker-panel-container:visible')
        await panel.waitFor()
        await page.waitForTimeout(300) // Inspect after the normal opening animation settles.
        const box = await panel.boundingBox()
        const fits = box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1
        checks.push({ route, theme, width, height, box, fits })
        await page.screenshot({ path: path.join(outputDir, `${route}-${theme}-${width}x${height}.png`) })
        // A shortened panel must still let the user reach its final controls.
        if (route === 'timestamp') {
          await panel.locator('.ant-picker-ok button').scrollIntoViewIfNeeded()
          assert.ok(await panel.locator('.ant-picker-ok button').isVisible())
        }
        await page.keyboard.press('Escape')
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ browserName, checks }, null, 2))
}
console.log(JSON.stringify({ checks: checks.length, failures: checks.filter((check) => !check.fits) }, null, 2))
assert.ok(checks.every((check) => check.fits), 'Popup outside viewport')
