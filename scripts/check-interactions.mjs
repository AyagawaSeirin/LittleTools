import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectLayout, installIpFixture } from './responsive-layout.mjs'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browserName = process.env.QA_BROWSER || 'chromium'
const browser = await playwright[browserName].launch({ ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) })
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'littletools-interactions', browserName)
await mkdir(outputDir, { recursive: true })
const checks = [], errors = [], failures = []
const widths = (process.env.QA_WIDTHS || '320,768,1440').split(',').map(Number)
const themes = (process.env.QA_THEMES || 'light,dark').split(',')
const routerSource = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const routes = [...routerSource.matchAll(/path: '(\/[^':]*)'/g)].map((match) => match[1]).filter((route) => !process.env.QA_ROUTES || process.env.QA_ROUTES.split(',').includes(route))

try {
  for (const theme of themes) for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript(() => {
      // Check copy handlers without replacing the user's system clipboard.
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => { window.__copiedText = text } } })
    })
    await context.addInitScript(installIpFixture, { ip: '2001:db8:1234:5678:1234:5678:1234:5678', country: 'United States', country_code: 'US', region: 'California', city: 'San Francisco', asn: 64500, asn_organization: 'Example International Network Services', timezone: 'America/Los_Angeles' })
    const warmup = await context.newPage()
    await warmup.goto(baseUrl)
    await warmup.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await warmup.waitForTimeout(250)
    await warmup.close()
    for (const route of routes) {
      const page = await context.newPage()
      page.setDefaultTimeout(10000)
      page.on('pageerror', (error) => errors.push({ route, width, theme, error: error.message }))
      const mark = async (state) => {
        const issues = await page.evaluate(inspectLayout)
        checks.push({ route, width, theme, state, issues })
        assert.deepEqual(issues, [], `${route} ${width} ${state}`)
      }
      // Ant buttons insert spaces into two-character labels; icons may prefix accessible names.
      const button = (name) => page.getByRole('button', { name: new RegExp(name.replace(/\s/g, '').split('').map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*') + '$') })
      const choose = async (fieldLabel, option) => {
        const field = page.locator('.form-field').filter({ has: page.locator('.field-label', { hasText: fieldLabel }) }).first()
        await field.locator('.ant-select').click()
        const dropdown = page.locator('.ant-select-dropdown:visible')
        await dropdown.waitFor()
        await dropdown.locator('.ant-select-item-option').filter({ hasText: option }).first().click()
      }
      const download = async (name) => {
        const pending = page.waitForEvent('download')
        await button(name).click()
        const result = await pending
        assert.ok(result.suggestedFilename())
        await result.saveAs(path.join(outputDir, result.suggestedFilename()))
      }
      try {
        await page.goto(`${baseUrl}/#${route}`)
        await page.locator('h1').waitFor()
        if (route === '/') {
          assert.equal(await page.locator('.tool-tile').count(), 14)
          await page.locator('.tool-tile').last().click()
          await page.waitForURL('**/#/tcpdump-generator')
          await page.getByRole('heading', { name: 'tcpdump 命令生成器', exact: true }).waitFor()
          if (width <= 920) {
            await button('打开菜单').click()
            const drawer = page.locator('.ant-drawer-content')
            await drawer.getByText('密码生成', { exact: true }).click()
            await page.getByRole('heading', { name: '随机密码生成', exact: true }).waitFor()
            await button('打开菜单').click()
            await page.locator('.ant-drawer-close').click()
            await page.locator('.ant-drawer-content').waitFor({ state: 'hidden' })
          } else {
            await page.locator('.side-menu').getByText('密码生成', { exact: true }).click()
            await page.getByRole('heading', { name: '随机密码生成', exact: true }).waitFor()
          }
          await button('自定义主题色').click()
          for (const color of ['#2463a7', '#7a4f9a', '#a44d58', '#a05d24', '#486b3d', '#276b63']) {
            await button(`选择主题色 ${color}`).click()
            assert.equal(await page.evaluate(() => localStorage.getItem('little-tools-color')), color)
          }
          for (const color of ['#ffff00', '#ffffff', '#000000', '#276b63']) {
            await page.locator('input[type=color]').fill(color)
            await page.waitForTimeout(50)
            const ratio = await page.locator('main .ant-btn-primary').first().evaluate((el) => {
              const luminance = (color) => {
                const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
                return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
              }
              const style = getComputedStyle(el), fg = luminance(style.color), bg = luminance(style.backgroundColor)
              return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
            })
            assert.ok(ratio >= 4.5, `Button contrast ${color}: ${ratio}`)
          }
          await page.keyboard.press('Escape')
          await button('自定义主题色').click()
          await button(theme === 'dark' ? '切换为白天模式' : '切换为黑夜模式').click()
          assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'light' : 'dark')
          await button(theme === 'dark' ? '切换为黑夜模式' : '切换为白天模式').click()
          await context.setOffline(true)
          await page.locator('.offline-tag').waitFor()
          assert.ok(await page.locator('.offline-tag .anticon').isVisible())
          assert.ok(await button('更新本地缓存').isDisabled())
          await mark('navigation, colors, theme, offline')
          await context.setOffline(false)
        } else if (route === '/password') {
          await page.getByRole('slider').focus(); await page.keyboard.press('End')
          await page.getByRole('spinbutton').fill('20'); await page.keyboard.press('Tab')
          await button('生成密码').click()
          const values = (await page.locator('.result-panel pre').innerText()).split('\n')
          assert.equal(values.length, 20); assert.ok(values.every((value) => value.length === 64))
          await button('复制').click(); assert.equal(await page.evaluate(() => window.__copiedText), values.join('\n'))
          await button('清空记录').click(); assert.equal(await page.locator('.history-list').count(), 0)
          for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.uncheck()
          assert.ok(await button('生成密码').isDisabled())
          await mark('64-character batch, copy, history, disabled generation')
        } else if (route === '/date-calculator' || route === '/timestamp') {
          for (const picker of await page.locator('.ant-picker input').all()) {
            await picker.click()
            const panel = page.locator('.ant-picker-panel-container:visible')
            await panel.waitFor()
            const box = await panel.boundingBox()
            assert.ok(box.x >= -1 && box.x + box.width <= width + 1 && box.y >= -1 && box.y + box.height <= 801, `Calendar outside viewport: ${JSON.stringify(box)}`)
            await page.screenshot({ path: path.join(outputDir, `${route.slice(1)}-${theme}-${width}-picker.png`) })
            await panel.locator('.ant-picker-cell-in-view').first().click()
            if (route === '/timestamp') await page.locator('.ant-picker-ok button').click()
            await page.keyboard.press('Escape')
          }
          if (route === '/date-calculator') { await button('交换日期').click(); await page.getByRole('checkbox').check() }
          else {
            await page.locator('.timestamp-input > input').fill('invalid')
            await button('转换').click(); await page.locator('.ant-alert-error').waitFor()
            await button('当前时间').click(); assert.equal(await page.locator('.ant-alert-error').count(), 0)
            await button('复制时间戳').click(); assert.match(await page.evaluate(() => window.__copiedText), /^\d+$/)
          }
          await mark('date/time popups, conversion and validation')
        } else if (route === '/random-port') {
          await button('生成端口').click()
          assert.equal((await page.locator('.result-panel pre').innerText()).split('\n').length, 10)
          await page.getByRole('spinbutton').nth(0).fill('65535'); await page.keyboard.press('Tab')
          await button('生成端口').click(); await page.locator('.ant-alert-error').waitFor()
          await mark('generated and invalid range')
        } else if (route === '/random-ip' || route === '/cidr-calculator') {
          await page.getByText('IPv6', { exact: true }).click()
          if (route === '/random-ip') {
            await page.getByText('CIDR', { exact: true }).click()
            await button('生成地址').click(); assert.match(await page.locator('.result-panel pre').innerText(), /2001:db8:/)
            await download('下载 .txt')
            await page.getByText('起止地址', { exact: true }).click()
            await button('生成地址').click()
          } else {
            assert.match(await page.locator('.cidr-results').innerText(), /ip6\.arpa/)
            await page.locator('.address-field input').fill('invalid')
            await button('计算范围').click(); await page.locator('.ant-alert-error').waitFor()
          }
          await mark('IPv6, range results and validation')
        } else if (route === '/ip-info') {
          await page.locator('.info-grid').waitFor(); await mark('long IPv6 result')
          await page.locator('.lookup-row input').fill('invalid')
          await button('开始查询').click(); await page.locator('.ant-alert-error').waitFor()
          await page.evaluate(() => { window.__failIpNetwork = true })
          await button('查询我的 IP').click(); await page.locator('.ant-alert-error').waitFor()
          await page.evaluate(() => { window.__failIpNetwork = false })
          await mark('invalid address and unavailable network')
        } else if (route === '/text-encoding') {
          await page.locator('textarea').first().fill('中文 & <test> 🧰')
          await button('开始编码').click(); await button('交换方向').click(); await button('开始解码').click()
          assert.equal(await page.locator('textarea').nth(1).inputValue(), '中文 & <test> 🧰')
          await button('复制').click(); assert.equal(await page.evaluate(() => window.__copiedText), '中文 & <test> 🧰')
          await page.locator('textarea').first().fill('%%%'); await button('开始解码').click(); await page.locator('.ant-alert-error').waitFor()
          await button('清空').click(); assert.equal(await page.locator('textarea').first().inputValue(), '')
          await mark('encoding round trip, copy, error, empty state')
        } else if (route === '/json-formatter') {
          await button('全部展开').click()
          assert.ok((await page.locator('.json-key').allTextContents()).includes('[0]'))
          assert.ok((await page.locator('.json-key').allTextContents()).includes('"features"'))
          if (theme === 'dark') assert.equal(await page.locator('.json-key').first().evaluate((el) => getComputedStyle(el).color), 'rgb(125, 174, 200)')
          await page.getByRole('textbox', { name: '在树形视图中搜索' }).fill('enabled')
          await page.locator('.active-match').waitFor(); await button('下一个匹配结果').click()
          await page.getByRole('textbox', { name: '在树形视图中搜索' }).fill('')
          await button('全部收起').click(); assert.equal(await page.locator('.json-node-row').count(), 1)
          await button('全部展开').click(); await button('压缩').click(); await button('格式化').click(); await download('下载')
          await page.locator('textarea').fill('{"long_' + 'x'.repeat(140) + '":' + ' '.repeat(150) + '}')
          await button('校验').click(); await page.locator('.json-error-panel').waitFor()
          await mark('tree controls, search, formatting, download, long error')
          await button('载入示例').click(); await button('清空').click(); await page.locator('.tree-empty').waitFor()
        } else if (route === '/address-generator') {
          await page.locator('.identity-head').waitFor()
          await page.locator('.country-strip button').filter({ hasText: /中国$/ }).click()
          await page.locator('.result-toolbar').filter({ hasText: '中国' }).waitFor()
          await page.getByRole('spinbutton').fill('3'); await page.keyboard.press('Tab')
          await button('立即生成').click(); await button('下一条结果').click()
          assert.match(await page.locator('.result-toolbar').innerText(), /2 \/ 3/)
          await page.locator('.identity-head button').click(); assert.ok((await page.evaluate(() => window.__copiedText)).length > 5)
          await download('JSON'); await download('CSV')
          await mark('country selection, batch, paging, copy, JSON and CSV')
        } else if (route.endsWith('-generator')) {
          for (const preset of await page.locator('.preset-grid button').all()) {
            await preset.click()
            assert.match(await page.locator('.result-panel pre').innerText(), /nmap|iperf3|tcpdump/)
            await mark(`preset: ${(await preset.locator('strong').innerText())}`)
          }
          if (route === '/nmap-generator') {
            await choose('扫描方式', 'TCP Connect'); await choose('端口选择', '自定义端口'); await choose('输出格式', 'XML')
          } else if (route === '/iperf3-generator') {
            await page.locator('.preset-grid button').first().click()
            await page.getByText('SCTP', { exact: true }).click()
            await choose('结束条件', '按字节数')
            await page.getByRole('checkbox', { name: '每行添加时间戳', exact: true }).check()
          } else {
            await page.locator('.preset-grid button').first().click()
            await page.getByText('过滤器文件', { exact: true }).click()
            await mark('filter file')
            await page.getByText('可视化条件', { exact: true }).click()
            await choose('端口模式', '端口范围'); await choose('运行模式', '读取文件列表')
          }
          await mark('advanced conditional fields')
        }
      } catch (error) {
        failures.push({ route, width, theme, error: error.message })
        await page.screenshot({ path: path.join(outputDir, `failure-${route.slice(1) || 'home'}-${theme}-${width}.png`), fullPage: true }).catch(() => {})
      } finally { await page.close() }
      console.log(`${browserName} ${theme} ${width} ${route}`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ browserName, checks, errors, failures }, null, 2))
}
console.log(JSON.stringify({ checks: checks.length, errors, failures }, null, 2))
assert.equal(errors.length, 0, 'Unexpected browser errors')
assert.equal(failures.length, 0, 'Interaction failures')
