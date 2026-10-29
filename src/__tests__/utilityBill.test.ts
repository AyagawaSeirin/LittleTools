import { describe, expect, it } from 'vitest'
import { billCountries, billTemplates, billMoney, createUtilityBill, formatBillName, randomBillAddress, validateBillForm, type BillForm } from '../utils/utilityBill'
import { escapeBillXml, renderBillPhotoSvg, renderBillSvg, wrapBillText } from '../utils/utilityBillRender'
import { isValidAddressPostalCode, type AddressDataPack } from '../utils/address'
import { utilityBillSources } from '../data/utilityBillSources'

const packs = import.meta.glob('../../public/address-data/*.json', { eager: true, import: 'default' }) as Record<string, AddressDataPack>
const now = new Date(2026, 0, 1, 12)
const form: BillForm = { title: 'Mr', name: 'Alex Morgan', address1: '12 Example Road', address2: '', city: 'London', region: 'England', postalCode: 'SW1A 2AA' }
const country = billCountries[0]
const template = billTemplates[0]
const make = (overrides: Partial<BillForm> = {}) => createUtilityBill(country, template, { ...form, ...overrides }, now, () => 0.5)

describe('utility bill generation', () => {
  it.each(billTemplates.map((entry) => [entry.id, entry] as const))('generates consistent dates, charges and meter readings for %s', (_, selectedTemplate) => {
    const selectedCountry = billCountries.find((item) => item.code === selectedTemplate.country)!
    const pack = packs[`../../public/address-data/${selectedCountry.code.toLowerCase()}.json`]
    for (let iteration = 0; iteration < 8; iteration++) {
      const address = randomBillAddress(selectedCountry, pack)
      const bill = createUtilityBill(selectedCountry, selectedTemplate, { ...form, ...address, name: '' }, now)
      expect(isValidAddressPostalCode(selectedCountry.code, bill.customer.postalCode)).toBe(true)
      expect(bill.customer.name).toMatch(/\p{L}/u)
      expect(bill.customer.name).not.toMatch(/\p{Script=Han}/u)
      expect(bill.readingEnd - bill.readingStart).toBe(bill.usage)
      expect(bill.lines.every((entry) => entry.quantity * entry.rateMinor === entry.amountMinor)).toBe(true)
      expect(bill.subtotalMinor).toBe(bill.lines.reduce((sum, entry) => sum + entry.amountMinor, 0))
      expect(bill.totalMinor).toBe(bill.subtotalMinor + bill.adjustmentMinor)
      expect(bill.totalMinor).toBeGreaterThan(0)
      expect((Date.parse(bill.periodEnd) - Date.parse(bill.periodStart)) / 86400000 + 1).toBe(bill.days)
      expect(Date.parse(bill.periodEnd)).toBeLessThan(Date.parse(bill.issued))
      expect(Date.parse(bill.issued)).toBeLessThan(Date.parse(bill.due))
      expect(bill.history.at(-1)).toBe(bill.usage)
      expect(renderBillSvg(bill)).not.toMatch(/NaN|undefined/)
    }
  })

  it('generates distinct documents for the same customer and preserves manual inputs', () => {
    const first = createUtilityBill(country, template, form, now)
    const second = createUtilityBill(country, template, form, now)
    expect(first.id).not.toBe(second.id)
    expect(first.account).not.toBe(second.account)
    expect(first.customer).toEqual(form)
    expect(first).not.toEqual(second)
    expect(form.name).toBe('Alex Morgan')
  })

  it('validates blank addresses, Chinese names, control characters, postal formats and long fields', () => {
    expect(validateBillForm(form, country)).toEqual({})
    expect(validateBillForm({ ...form, name: '' }, country)).toEqual({})
    expect(validateBillForm({ ...form, name: '张三', address1: ' ', city: '', postalCode: '123' }, country)).toHaveProperty('name')
    expect(validateBillForm({ ...form, address1: 'x\n<script>', name: '123' }, country)).toHaveProperty('address1')
    expect(validateBillForm({ ...form, city: 'x'.repeat(61) }, country)).toHaveProperty('city')
    expect(validateBillForm({ ...form, name: 'x'.repeat(71) }, country)).toHaveProperty('name')
    expect(validateBillForm({ ...form, postalCode: '' }, billCountries[1])).toEqual({})
    expect(() => createUtilityBill(country, billTemplates[2], form)).toThrow('账单模板与国家不匹配')
    expect(() => make({ address1: '' })).toThrow('地址第 1 行')
  })

  it('normalizes whitespace and postal case without changing manual name capitalization', () => {
    const bill = make({ name: ' Alex   McDonald ', postalCode: 'sw1a 2aa' })
    expect(bill.customer.name).toBe('Alex McDonald')
    expect(bill.customer.postalCode).toBe('SW1A 2AA')
    expect(formatBillName("  éMILIE   o'BRIEN-smith ", country)).toBe("Émilie O'Brien-Smith")
    expect(formatBillName('Alex Morgan', billCountries[1])).toBe('ALEX MORGAN')
    expect(billMoney(1234, country)).toBe('£12.34')
    expect(billMoney(-0, country)).toBe('£0.00')
    expect(billMoney(1234, billCountries.at(-1)!)).toContain('1,234')
  })
})

describe('utility bill rendering', () => {
  it('escapes user-provided SVG/HTML metacharacters and has no overlay watermark or blurred main image', () => {
    const bill = make({ name: 'Alex <script> & "Example"', address1: "12 O'Brien & Sons <Road>" })
    const svg = renderBillSvg(bill)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('O&apos;Brien &amp; Sons &lt;Road&gt;')
    expect(svg).toContain('FICTIONAL DEMONSTRATION')
    expect(svg).not.toMatch(/watermark|feGaussianBlur|filter=|rotate\(/)
    expect(escapeBillXml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&apos;')
    expect(renderBillPhotoSvg(bill, svg)).toContain('Alex &lt;script&gt;')
  })

  it('keeps full maximum-length customer text inside its reserved area in every layout', () => {
    expect(wrapBillText('A'.repeat(80), 120, 12).length).toBeGreaterThan(2)
    for (const selectedTemplate of billTemplates) {
      const selectedCountry = billCountries.find((item) => item.code === selectedTemplate.country)!
      const pack = packs[`../../public/address-data/${selectedCountry.code.toLowerCase()}.json`]
      const bill = createUtilityBill(selectedCountry, selectedTemplate, { ...form, ...randomBillAddress(selectedCountry, pack), name: 'W'.repeat(70), address1: '路'.repeat(90), address2: '号'.repeat(90), city: '城'.repeat(60), region: '区'.repeat(60) }, now)
      const svg = renderBillSvg(bill)
      const customerBlock = svg.match(/<g data-customer="true" data-top="([\d.]+)" data-bottom="([\d.]+)">([\s\S]*?)<\/g>/)!
      expect(customerBlock).not.toBeNull()
      const rows = [...customerBlock[3].matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
      expect(rows.length).toBeGreaterThan(6)
      expect(Math.max(...rows.map((match) => Number(match[1])))).toBeLessThan(Number(customerBlock[2]))
      for (const character of ['路', '号', '城', '区']) expect(customerBlock[3].split(character).length - 1).toBe(character === '路' || character === '号' ? 90 : 60)
    }
  })

  it('uses distinct documented layouts rather than recoloring a shared document', () => {
    const signatures = new Set<string>()
    for (const entry of billTemplates) {
      expect(utilityBillSources[entry.id].url).toMatch(/^https:\/\//)
      const bill = make()
      bill.template = entry
      const svg = renderBillSvg(bill)
      signatures.add(svg.replace(/#[a-f\d]{3,8}/gi, '').replace(/<text[\s\S]*?<\/text>/g, ''))
      expect(svg).toContain('SAMPLE')
      expect(svg).not.toMatch(/<image|https:\/\//)
    }
    expect(signatures.size).toBe(billTemplates.length)
  })
})
