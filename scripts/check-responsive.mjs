import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectLayout, installIpFixture } from './responsive-layout.mjs'

// Use an existing Playwright installation; this audit adds no project dependencies.
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const executablePath = process.env.QA_BROWSER_EXECUTABLE
const browser = await playwright[browserName].launch({ ...(executablePath ? { executablePath } : {}) })
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-responsive', browserName)
const widths = (process.env.QA_WIDTHS || '320,360,375,390,414,420,421,480,481,520,521,560,561,640,641,700,701,720,721,760,761,768,820,920,921,980,981,1024,1080,1100,1180,1248,1249,1280,1366,1440,1920,2560').split(',').map(Number)
const themes = (process.env.QA_THEMES || 'light,dark').split(',')
const screenshotWidths = [320, 768, 1440]
const routerSource = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const routes = [...routerSource.matchAll(/path: '(\/[^':]*)'/g)].map((match) => match[1])
assert.equal(routes.length, 15, 'Update the audit coverage when adding routes')
const report = { browser: browserName, baseUrl, widths, themes, checks: [], errors: [] }
await mkdir(outputDir, { recursive: true })

// Stable, deliberately long IPv6/network data exercises wrapping without relying on external APIs.
const ipFixture = {
  ip: '2001:db8:1234:5678:1234:5678:1234:5678', country: 'United States', country_code: 'US',
  city: 'San Francisco', region: 'California', asn: 64500,
  asn_organization: 'Example International Telecommunications and Network Services',
  isp: 'Example Internet Services', timezone: 'America/Los_Angeles', latitude: 37.77, longitude: -122.42,
}


try {
  for (const theme of themes) {
    const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript((mode) => localStorage.setItem('little-tools-mode', mode), theme)
    await context.addInitScript(installIpFixture, ipFixture)
    // Let the production service worker finish its first-control reload before measurements.
    const warmup = await context.newPage()
    await warmup.goto(baseUrl)
    await warmup.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await warmup.waitForTimeout(250)
    await warmup.close()
    for (const route of routes) {
      const page = await context.newPage()
      const slug = route.slice(1) || 'home'
      page.on('pageerror', (error) => report.errors.push({ route, theme, error: error.message }))
      await page.goto(`${baseUrl}/#${route}`)
      await page.locator('h1').waitFor()
      if (route === '/address-generator') await page.locator('.identity-head').waitFor()
      if (route === '/ip-info') await page.locator('.info-grid').waitFor()
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        const issues = await page.evaluate(inspectLayout)
        report.checks.push({ route, theme, width, height: 900, issues })
        if (screenshotWidths.includes(width)) await page.screenshot({ path: path.join(outputDir, `${slug}-${theme}-${width}.png`), fullPage: true })
      }
      // Short landscape screens also need to reach the bottom and every preview.
      for (const [width, height] of [[667, 375], [896, 414], [1440, 600]]) {
        await page.setViewportSize({ width, height })
        await page.locator('.app-footer').scrollIntoViewIfNeeded()
        report.checks.push({ route, theme, width, height, issues: await page.evaluate(inspectLayout) })
      }
      await page.close()
      console.log(`${browserName} ${theme} ${route}: ${widths.length + 3} viewports`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
}
const failures = report.checks.filter((check) => check.issues.length)
console.log(JSON.stringify({ checks: report.checks.length, failures: failures.length, errors: report.errors, outputDir, details: failures }, null, 2))
assert.equal(report.errors.length, 0, 'Unexpected browser errors')
assert.equal(failures.length, 0, 'Responsive layout regressions')
