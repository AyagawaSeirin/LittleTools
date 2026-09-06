export function installIpFixture(fixture) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, options) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!/^https:\/\/(api\.ip\.sb|ipwho\.is|monip\.lws\.fr)\//.test(url)) return originalFetch(input, options)
    return new Response(window.__failIpNetwork ? 'Temporarily unavailable' : JSON.stringify(fixture), {
      status: window.__failIpNetwork ? 503 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export function inspectLayout() {
  const issues = []
  const visible = (el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const identify = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} ${(el.textContent || '').trim().slice(0, 70)}`
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`Document overflows: ${document.documentElement.scrollWidth} > ${innerWidth}`)
  const targets = document.querySelectorAll('main h1, main h2, main h3, main p, main button, main .ant-select, main .ant-input, main .ant-picker, main .ant-segmented, main .field-label, .topbar-left, .topbar-actions')
  for (const el of targets) {
    if (!visible(el) || el.closest('.country-strip, .json-tree-wrap')) continue
    const r = el.getBoundingClientRect()
    if (r.left < -1 || r.right > innerWidth + 1) issues.push(`Outside viewport: ${identify(el)}`)
    let parent = el.parentElement
    while (parent && parent.tagName !== 'BODY') {
      const pr = parent.getBoundingClientRect(), s = getComputedStyle(parent)
      if (['hidden', 'clip'].includes(s.overflowX) && (r.left < pr.left - 1 || r.right > pr.right + 1)) {
        issues.push(`Clipped by ${identify(parent)}: ${identify(el)}`)
        break
      }
      parent = parent.parentElement
    }
  }
  // These regions must fit intrinsically, even if an ancestor hides their overflow.
  for (const el of document.querySelectorAll('.form-field, .preset-grid button, .tree-search-bar, .timestamp-input, .cidr-input-row, .ip-prefill, .result-toolbar, .ant-segmented-item-label, .tool-tile, .page-context')) {
    if (!visible(el)) continue
    if (el.scrollWidth > el.clientWidth + 2) issues.push(`Content overflows: ${identify(el)} (${el.scrollWidth}/${el.clientWidth})`)
    if (el.matches('.ant-segmented-item-label') && el.scrollHeight > el.clientHeight + 2) issues.push(`Option text clipped: ${identify(el)}`)
  }
  // Home descriptions, titles and arrows must never occupy the same space.
  for (const tile of document.querySelectorAll('.tool-tile')) {
    const elements = [...tile.querySelectorAll('h3, p, .tile-arrow')]
    for (let i = 0; i < elements.length; i++) for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i].getBoundingClientRect(), b = elements[j].getBoundingClientRect()
      if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) issues.push(`Overlapping home content: ${identify(tile)}`)
    }
  }
  return [...new Set(issues)]
}
