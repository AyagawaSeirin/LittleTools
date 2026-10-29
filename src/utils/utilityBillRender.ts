import { billDate, billFilename, billMoney, type UtilityBill } from './utilityBill'

export const BILL_WIDTH = 840
export const BILL_HEIGHT = 1188
export const PHOTO_WIDTH = 1800
export const PHOTO_HEIGHT = 1500

export function escapeBillXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

// Wrap by estimated glyph width, including unspaced addresses and CJK glyphs.
export function wrapBillText(value: string, width: number, size: number) {
  const lines: string[] = []
  let line = ''
  let used = 0
  for (const character of Array.from(value)) {
    const advance = size * (/[^\u0000-\u024f]/u.test(character) ? 1 : /[MW@%]/.test(character) ? 0.9 : /[il.,' ]/.test(character) ? 0.3 : 0.6)
    if (used + advance > width && line) { lines.push(line.trimEnd()); line = ''; used = 0 }
    line += character
    used += advance
  }
  if (line) lines.push(line.trimEnd())
  return lines
}

export function renderBillSvg(bill: UtilityBill) {
  const { country, template, customer } = bill
  const color = template.color
  const money = (value: number) => billMoney(value, country)
  const date = (value: string) => billDate(value, country)
  const text = (value: string, x: number, y: number, size = 14, fill = '#26333f', weight = 400, anchor = 'start') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${escapeBillXml(value)}</text>`
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = '#dbe1e7') => `<path d="M${x1} ${y1}H${x2}" transform="translate(0 ${y2 - y1})" stroke="${stroke}"/>`
  const rect = (x: number, y: number, width: number, height: number, fill: string) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`
  const isBand = template.layout === 'band'
  const isLedger = template.layout === 'ledger'
  const isSplit = template.layout === 'split'
  const documentTitle = country.code === 'DE' ? 'Stromabrechnung' : country.code === 'IT' ? 'Bolletta energia elettrica' : country.code === 'JP' ? '電気ご使用量のお知らせ' : template.kind === 'water' ? 'Your water statement' : 'Your electricity statement'
  let content = rect(0, 0, 840, 1188, '#ffffff')
  if (isBand) content += rect(0, 0, 840, 125, color)
  else content += rect(0, 0, isSplit ? 18 : 840, isSplit ? 1188 : 9, color)
  content += text(template.issuer, 52, 69, 29, isBand ? '#ffffff' : color, 700)
  content += text(`${country.label}  /  ${template.kind === 'water' ? 'WATER SERVICES' : 'RESIDENTIAL ENERGY'}`, 54, 94, 11, isBand ? '#ffffff' : '#596975', 500)
  content += text('ACCOUNT STATEMENT', 788, 62, 11, isBand ? '#ffffff' : '#5e6c77', 600, 'end')
  content += text(date(bill.issued), 788, 85, 14, isBand ? '#ffffff' : '#26333f', 500, 'end')
  content += text(documentTitle, 52, 164, 27, color, 600)
  content += text(`Statement ${bill.id}`, 54, 190, 11, '#61707d')
  if (isLedger) content += `<rect x="52" y="211" width="736" height="258" fill="none" stroke="${color}" stroke-width="1.2"/>`
  const left = isLedger ? 68 : 54
  content += text('ACCOUNT HOLDER / SERVICE ADDRESS', left, 239, 10, '#687785', 600)
  const addressLines = [customer.address1, customer.address2, [customer.city, customer.region].filter(Boolean).join(', '), customer.postalCode].filter(Boolean)
  const fullName = `${customer.title ? `${customer.title} ` : ''}${customer.name}`
  let scale = 1
  const addressHeight = () => wrapBillText(fullName, 416, 18 * scale).length * (23 * scale)
    + addressLines.flatMap((value) => wrapBillText(value, 416, 13 * scale)).length * (18 * scale) + 6
  while (addressHeight() > 185 && scale > 0.65) scale -= 0.05
  let addressY = 270
  for (const value of wrapBillText(fullName, 416, 18 * scale)) {
    content += text(value, left, addressY, 18 * scale, '#26333f', 600); addressY += 23 * scale
  }
  addressY += 6
  for (const value of addressLines) {
    for (const chunk of wrapBillText(value, 416, 13 * scale)) {
      content += text(chunk, left, addressY, 13 * scale, '#4c5b68'); addressY += 18 * scale
    }
  }
  content += rect(520, 211, 268, 168, isSplit ? color : template.pale)
  const balanceText = isSplit ? '#ffffff' : color
  content += text('TOTAL FOR THIS PERIOD', 540, 242, 11, balanceText, 600)
  // Long formatted currencies (e.g. PHP) are kept inside the balance panel.
  const total = money(bill.totalMinor)
  content += text(total, 540, 292, total.length > 12 ? 28 : 35, balanceText, 700)
  content += text(`Due ${date(bill.due)}`, 540, 325, 13, balanceText)
  content += text(`${bill.days} days · ${bill.usage} ${bill.unit}`, 540, 351, 12, balanceText)
  content += text('Account number', 535, 408, 11, '#687785')
  content += text(bill.account, 772, 408, 12, '#26333f', 500, 'end')
  content += text('Meter number', 535, 432, 11, '#687785')
  content += text(bill.meter, 772, 432, 12, '#26333f', 500, 'end')
  content += text('Billing period', 54, 498, 12, '#687785')
  content += text(`${date(bill.periodStart)} – ${date(bill.periodEnd)}`, 788, 498, 13, '#26333f', 500, 'end')
  content += rect(52, 517, 736, 38, isLedger ? color : template.pale)
  const headerColor = isLedger ? '#ffffff' : color
  content += text('Charge description', 66, 542, 12, headerColor, 600)
  content += text('Usage', 490, 542, 12, headerColor, 600, 'end')
  content += text('Unit price', 625, 542, 12, headerColor, 600, 'end')
  content += text('Amount', 773, 542, 12, headerColor, 600, 'end')
  let rowY = 586
  for (const entry of bill.lines) {
    content += text(entry.label, 66, rowY, 14)
    content += text(`${entry.quantity} ${entry.unit}`, 490, rowY, 13, '#4c5b68', 400, 'end')
    content += text(money(entry.rateMinor), 625, rowY, 13, '#4c5b68', 400, 'end')
    content += text(money(entry.amountMinor), 773, rowY, 14, '#26333f', 500, 'end')
    content += line(52, rowY + 17, 788, rowY + 17)
    rowY += 45
  }
  content += text('Subtotal', 530, 737, 13, '#4c5b68') + text(money(bill.subtotalMinor), 773, 737, 14, '#26333f', 400, 'end')
  content += text('Sample account credit', 530, 765, 12, '#4c5b68') + text(money(bill.adjustmentMinor), 773, 765, 14, '#26333f', 400, 'end')
  content += line(520, 781, 788, 781, color)
  content += text('Total', 530, 812, 18, color, 600) + text(total, 773, 812, 23, color, 700, 'end')
  content += text('Meter readings', 54, 736, 16, color, 600)
  content += text(`Previous  ${bill.readingStart.toLocaleString('en-GB')} ${bill.unit}`, 54, 765, 13, '#4c5b68')
  content += text(`Current    ${bill.readingEnd.toLocaleString('en-GB')} ${bill.unit}`, 54, 789, 13, '#4c5b68')
  content += text(`Recorded usage: ${bill.usage} ${bill.unit}`, 54, 813, 12, '#687785')
  content += line(52, 844, 788, 844)
  content += text('Your usage at a glance', 54, 876, 17, color, 600)
  const peak = Math.max(...bill.history)
  bill.history.forEach((value, index) => {
    const barHeight = Math.round(value / peak * 95)
    const x = 70 + index * 65
    const month = new Date(`${bill.periodEnd}T00:00:00Z`)
    month.setUTCDate(1)
    month.setUTCMonth(month.getUTCMonth() - (5 - index))
    const label = new Intl.DateTimeFormat(country.locale, { month: 'short', timeZone: 'UTC' }).format(month)
    content += rect(x, 1013 - barHeight, 33, barHeight, index === 5 ? color : '#dbe3e8')
    content += text(String(value), x + 16, 1004 - barHeight, 10, '#687785', 400, 'middle')
    content += text(label, x + 16, 1034, 10, '#687785', 400, 'middle')
  })
  content += text('About this statement', 530, 888, 15, color, 600)
  for (const [index, value] of [
    'Illustrative household consumption.',
    'Rates and charges are sample values.',
    'No payment is requested or accepted.',
    'Prepared locally with LittleTools.',
  ].entries()) content += text(value, 530, 921 + index * 24, 12, '#596975')
  content += line(52, 1082, 788, 1082)
  content += text('FICTIONAL DEMONSTRATION · NOT AN OFFICIAL DOCUMENT', 420, 1110, 10, '#687785', 500, 'middle')
  content += text('For design, education and software testing. Not valid as proof of address.', 420, 1130, 10, '#687785', 400, 'middle')
  content += text('LittleTools Document Studio', 54, 1160, 9, '#84909a') + text('1 / 1', 788, 1160, 9, '#84909a', 400, 'end')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1188" viewBox="0 0 840 1188"><g font-family="Arial, 'Noto Sans', 'PingFang SC', 'Yu Gothic', sans-serif">${content}</g></svg>`
}

export function renderBillPhotoSvg(bill: UtilityBill, mainSvg: string) {
  const backgrounds = [['#c9b9a2', '#b09e85'], ['#bdc6c4', '#9caaa7'], ['#c6c2bc', '#a8a39b']]
  const tone = backgrounds[bill.photoTone]
  const documentBody = mainSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" viewBox="0 0 ${PHOTO_WIDTH} ${PHOTO_HEIGHT}">
    <defs>
      <linearGradient id="desk" x2="1" y2="1"><stop stop-color="${tone[0]}"/><stop offset="1" stop-color="${tone[1]}"/></linearGradient>
      <linearGradient id="light" x2="1" y2="0.6"><stop stop-color="#fff" stop-opacity=".17"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#243030" stop-opacity=".06"/></linearGradient>
      <linearGradient id="fold"><stop stop-color="#000" stop-opacity="0"/><stop offset=".49" stop-color="#000" stop-opacity=".035"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <pattern id="grain" width="135" height="50" patternUnits="userSpaceOnUse"><path d="M0 7L135 5M0 30L135 33" stroke="#fff" opacity=".07"/><path d="M0 47L135 48" stroke="#544c42" opacity=".05"/></pattern>
      <filter id="shadow" x="-25%" y="-25%" width="160%" height="160%"><feDropShadow dx="12" dy="20" stdDeviation="18" flood-opacity=".26"/></filter>
    </defs>
    <rect width="1800" height="1500" fill="url(#desk)"/><rect width="1800" height="1500" fill="url(#grain)"/>
    <g transform="translate(480 145) rotate(${bill.photoAngle} 420 594) skewX(-1.2)">
      <rect width="840" height="1188" fill="#fff" filter="url(#shadow)"/>
      ${documentBody}
      <rect width="840" height="1188" fill="url(#light)"/>
      <rect x="405" width="30" height="1188" fill="url(#fold)"/>
    </g>
  </svg>`
}

export async function rasterizeBill(svg: string, width: number, height: number, type: 'image/png' | 'image/jpeg') {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法生成图片，请更换支持 Canvas 的浏览器')
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片导出失败')), type, 0.95))
    // Reclaim the larger bitmap as soon as encoding finishes.
    canvas.width = canvas.height = 0
    return blob
  } finally { URL.revokeObjectURL(url) }
}

export async function createBillPdf(main: Blob, bill: UtilityBill) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: `${bill.template.issuer} — demonstration`, subject: 'Fictional utility bill demonstration', creator: 'LittleTools' })
  pdf.addImage(new Uint8Array(await main.arrayBuffer()), 'PNG', 0, 0, 210, 297)
  return pdf.output('blob')
}

export async function createBillZip(bill: UtilityBill, main: Blob, photo: Blob, includeMain: boolean, includePhoto: boolean) {
  if (!includeMain && !includePhoto) throw new Error('请至少选择一个下载文件')
  const { zipSync } = await import('fflate')
  const filename = billFilename(bill)
  const files: Record<string, Uint8Array> = {}
  if (includeMain) {
    files[`${filename}.png`] = new Uint8Array(await main.arrayBuffer())
    files[`${filename}.pdf`] = new Uint8Array(await (await createBillPdf(main, bill)).arrayBuffer())
  }
  if (includePhoto) files[`${filename}-photo.jpg`] = new Uint8Array(await photo.arrayBuffer())
  // PNG/JPEG/PDF are already compressed; storing avoids blocking on recompression.
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export function downloadBillBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
