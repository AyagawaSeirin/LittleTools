import { billDate, billMoney, type UtilityBill } from './utilityBill'

export function escapeBillXml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
}

export function wrapBillText(value: string, width: number, size: number) {
  const lines: string[] = []
  const advance = (c: string) => size * (/[^\u0000-\u024f]/u.test(c) ? 1 : /[MW@%]/.test(c) ? 0.9 : /[il.,' ]/.test(c) ? 0.3 : 0.6)
  const measure = (text: string) => Array.from(text).reduce((total, c) => total + advance(c), 0)
  let line = ''
  for (const word of value.trim().split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate) <= width) { line = candidate; continue }
    if (line) { lines.push(line); line = '' }
    // Only split within a word when it cannot fit on an otherwise empty line.
    for (const c of Array.from(word)) {
      if (measure(line + c) > width && line) { lines.push(line); line = '' }
      line += c
    }
  }
  if (line) lines.push(line)
  return lines
}

export class BillPaper {
  parts: string[] = []
  ink: string
  tint: string
  constructor(public bill: UtilityBill) {
    this.ink = bill.template.color
    this.tint = bill.template.pale
    this.rect(0, 0, 840, 1188, '#fff')
  }
  money(value: number) { return billMoney(value, this.bill.country) }
  date(value: string) { return billDate(value, this.bill.country) }
  text(value: string | number, x: number, y: number, size = 12, color = '#202327', weight = 400, anchor = 'start') {
    this.parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${escapeBillXml(String(value))}</text>`)
  }
  fit(value: string, x: number, y: number, width: number, size = 24, color = this.ink, weight = 700, anchor = 'start') {
    let font = size
    while (wrapBillText(value, width, font).length > 1 && font > 8) font -= 0.5
    this.text(value, x, y, font, color, weight, anchor)
  }
  rect(x: number, y: number, width: number, height: number, fill: string, radius = 0, stroke = 'none', strokeWidth = 1) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" rx="${radius}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
  }
  rule(x: number, y: number, width: number, color = '#c5cbd0', dash = false) {
    this.parts.push(`<path d="M${x} ${y}h${width}" stroke="${color}"${dash ? ' stroke-dasharray="4 4"' : ''}/>`)
  }
  paragraph(value: string, x: number, y: number, width: number, size = 12, color = '#333', lineHeight = size * 1.4) {
    const lines = wrapBillText(value, width, size)
    lines.forEach((line, i) => this.text(line, x, y + i * lineHeight, size, color))
    return y + lines.length * lineHeight
  }
  brand(x = 48, y = 70, size = 30, width = 480, anchor = 'start') {
    this.fit(this.bill.template.issuer, x, y, width, size, this.ink, 700, anchor)
    this.text('SAMPLE · 示例账单', x, y + 20, 10, '#5c6570', 600, anchor)
  }
  customer(x: number, y: number, width: number, height = 150, size = 13) {
    const c = this.bill.customer
    const fields = [`${c.title ? `${c.title} ` : ''}${c.name}`, c.address1, c.address2, [c.city, c.region].filter(Boolean).join(', '), c.postalCode].filter(Boolean)
    let font = size
    const rows = () => fields.flatMap((field) => wrapBillText(field, width, font))
    while (rows().length * font * 1.4 > height && font > 7) font -= 0.25
    this.parts.push(`<g data-customer="true" data-top="${y}" data-bottom="${y + height}">`)
    rows().forEach((value, i) => this.text(value, x, y + i * font * 1.4, font, '#23262b', i === 0 ? 600 : 400))
    this.parts.push('</g>')
  }
  pairs(rows: [string, string][], x: number, y: number, width: number, spacing = 25, size = 12) {
    rows.forEach(([label, value], i) => {
      this.text(label, x, y + i * spacing, size, '#515b64')
      this.fit(value, x + width, y + i * spacing, width * 0.58, size, '#222', 500, 'end')
    })
  }
  section(label: string, x: number, y: number, width: number, fill = this.ink, color = '#fff') {
    this.rect(x, y, width, 28, fill)
    this.text(label, x + 10, y + 19, 13, color, 700)
  }
  amount(x: number, y: number, width: number, label = 'Amount due', fill = this.tint, color = this.ink) {
    this.rect(x, y, width, 122, fill, 5)
    this.text(label, x + 16, y + 27, 13, color, 600)
    this.fit(this.money(this.bill.totalMinor), x + 16, y + 73, width - 32, 34, color)
    this.text(this.date(this.bill.due), x + 16, y + 101, 14, color, 600)
  }
  summary(x: number, y: number, width: number, heading = 'Account summary') {
    this.section(heading, x, y, width)
    this.pairs([
      ['Previous balance', this.money(0)],
      ['Current charges', this.money(this.bill.subtotalMinor)],
      ['Account credit', this.money(this.bill.adjustmentMinor)],
    ], x + 12, y + 54, width - 24, 30)
    this.rule(x + 12, y + 131, width - 24, this.ink)
    this.text('Total', x + 12, y + 158, 15, this.ink, 700)
    this.fit(this.money(this.bill.totalMinor), x + width - 12, y + 158, width * .5, 22, this.ink, 700, 'end')
  }
  charges(x: number, y: number, width: number, heading = 'Current charges', labels?: string[]) {
    const headers: Record<string, string[]> = {
      DE: ['Beschreibung', 'Verbrauch', 'Preis', 'Betrag'], IT: ['Descrizione', 'Consumo', 'Prezzo', 'Importo'],
      JP: ['内訳', '使用量', '単価', '金額'], MY: ['Keterangan', 'Kegunaan', 'Kadar', 'Amaun'],
      HK: ['項目 / Description', '用量', '單價', '金額'],
    }
    const header = headers[this.bill.country.code] || ['Description', 'Quantity', 'Rate', 'Amount']
    this.section(heading, x, y, width, this.tint, this.ink)
    this.text(header[0], x + 10, y + 48, 10, '#59616a', 600)
    this.text(header[1], x + width * .59, y + 48, 10, '#59616a', 600, 'end')
    this.text(header[2], x + width * .77, y + 48, 10, '#59616a', 600, 'end')
    this.text(header[3], x + width - 10, y + 48, 10, '#59616a', 600, 'end')
    this.bill.lines.forEach((entry, index) => {
      const row = y + 77 + index * 31
      this.fit(labels?.[index] || entry.label, x + 10, row, width * .38, 12, '#222', 400)
      const periodUnits: Record<string, string> = { DE: 'Zeitraum', IT: 'periodo', JP: '期間', MY: 'tempoh', HK: '期' }
      const unit = entry.unit === 'period' ? (periodUnits[this.bill.country.code] || entry.unit) : entry.unit
      this.text(`${entry.quantity} ${unit}`, x + width * .59, row, 11, '#333', 400, 'end')
      this.text(this.money(entry.rateMinor), x + width * .77, row, 11, '#333', 400, 'end')
      this.text(this.money(entry.amountMinor), x + width - 10, row, 12, '#222', 500, 'end')
      this.rule(x, row + 11, width)
    })
  }
  readings(x: number, y: number, width: number, label = 'Meter reading details') {
    this.section(label, x, y, width, this.tint, this.ink)
    const labels: Record<string, string[]> = { HK: ['錶號 Meter', '上次 Previous', '今次 Current', '用量 Usage'], JP: ['計器番号', '前回指示数', '今回指示数', '使用量'], MY: ['No. Meter', 'Dahulu', 'Semasa', 'Kegunaan'] }
    const columns = labels[this.bill.country.code] || ['Meter number', 'Previous', 'Current', 'Usage']
    const values = [this.bill.meter, String(this.bill.readingStart), String(this.bill.readingEnd), `${this.bill.usage} ${this.bill.unit}`]
    columns.forEach((title, i) => {
      const col = x + 10 + i * width / 4
      this.text(title, col, y + 47, 10, '#59616a')
      this.text(values[i], col, y + 70, 12, '#222', 600)
    })
    this.rule(x, y + 83, width)
  }
  chart(x: number, y: number, width: number, height: number, label = 'Your consumption history', color = this.ink) {
    this.text(label, x, y, 13, this.ink, 700)
    const base = y + height - 25, plotHeight = height - 55, step = width / 6
    for (let i = 0; i < 4; i++) this.rule(x, base - i * plotHeight / 3, width, '#dce0e3')
    const peak = Math.max(...this.bill.history)
    this.bill.history.forEach((value, i) => {
      const h = Math.max(4, value / peak * (plotHeight - 14))
      const center = x + step * (i + .5)
      this.rect(center - step * .22, base - h, step * .44, h, color)
      this.text(String(value), center, base - h - 5, 9, '#555', 400, 'middle')
      const month = new Date(`${this.bill.periodEnd}T00:00:00Z`)
      month.setUTCDate(1); month.setUTCMonth(month.getUTCMonth() - 5 + i)
      this.text(new Intl.DateTimeFormat(this.bill.country.locale, { month: 'short', timeZone: 'UTC' }).format(month), center, base + 17, 9, '#555', 400, 'middle')
    })
  }
  slip(y: number, color = this.ink, label = 'PAYMENT SUMMARY · SAMPLE ONLY') {
    this.rule(42, y, 756, '#929aa1', true)
    this.text(label, 48, y + 28, 11, color, 700)
    this.text('Account reference', 48, y + 58, 10, '#666')
    this.text(this.bill.account, 48, y + 79, 13, '#222', 600)
    this.text('Amount', 360, y + 58, 10, '#666')
    this.text(this.money(this.bill.totalMinor), 360, y + 82, 24, color, 700)
    this.text('Due date', 610, y + 58, 10, '#666')
    this.text(this.date(this.bill.due), 610, y + 79, 14, '#222', 600)
    this.text('No payment barcode or payment instructions are included in this sample.', 48, y + 109, 10, '#666')
  }
  end() {
    this.rule(42, 1130, 756)
    this.text('FICTIONAL DEMONSTRATION · NOT AN OFFICIAL DOCUMENT', 420, 1151, 10, '#626a71', 600, 'middle')
    this.text('Unofficial layout study. Sample data only. No payment due. Not valid as proof of address.', 420, 1168, 9, '#626a71', 400, 'middle')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1188" viewBox="0 0 840 1188"><g font-family="Arial, 'Noto Sans', 'PingFang SC', 'Yu Gothic', sans-serif">${this.parts.join('')}</g></svg>`
  }
}
