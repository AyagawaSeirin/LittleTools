import { addressCountries, generateAddressProfiles, isValidAddressPostalCode, type AddressDataPack } from './address'

export type BillCountryCode = 'GB' | 'HK' | 'AU' | 'US' | 'SG' | 'CA' | 'MY' | 'PH' | 'NZ' | 'DE' | 'IT' | 'JP'
export type BillLayout = 'classic' | 'band' | 'ledger' | 'split'
export interface BillCountry {
  code: BillCountryCode
  label: string
  name: string
  flag: string
  currency: string
  locale: string
  regionLabel: string
  uppercase: boolean
  titles: string[]
  rate: number
  fee: number
}
export interface BillTemplate {
  id: string
  country: BillCountryCode
  name: string
  issuer: string
  kind: 'water' | 'electricity'
  color: string
  pale: string
  layout: BillLayout
}
export interface BillForm {
  title: string
  name: string
  address1: string
  address2: string
  city: string
  region: string
  postalCode: string
}
export interface BillLine {
  label: string
  quantity: number
  unit: string
  rateMinor: number
  amountMinor: number
}
export interface UtilityBill {
  id: string
  country: BillCountry
  template: BillTemplate
  customer: BillForm
  issued: string
  due: string
  periodStart: string
  periodEnd: string
  account: string
  meter: string
  readingStart: number
  readingEnd: number
  usage: number
  unit: string
  days: number
  lines: BillLine[]
  subtotalMinor: number
  adjustmentMinor: number
  totalMinor: number
  history: number[]
  photoAngle: number
  photoTone: number
}

export const billCountries: BillCountry[] = [
  { code: 'GB', label: 'UK', name: '英国', flag: '🇬🇧', currency: 'GBP', locale: 'en-GB', regionLabel: '郡 / 地区', uppercase: false, titles: ['Mr', 'Mrs', 'Ms'], rate: 27, fee: 1400 },
  { code: 'HK', label: 'HK', name: '中国香港', flag: '🇭🇰', currency: 'HKD', locale: 'en-HK', regionLabel: '行政区', uppercase: true, titles: [], rate: 138, fee: 3600 },
  { code: 'AU', label: 'AU', name: '澳大利亚', flag: '🇦🇺', currency: 'AUD', locale: 'en-AU', regionLabel: '州 / 地区', uppercase: false, titles: [], rate: 32, fee: 2100 },
  { code: 'US', label: 'US', name: '美国', flag: '🇺🇸', currency: 'USD', locale: 'en-US', regionLabel: '州 / 地区', uppercase: true, titles: [], rate: 24, fee: 1800 },
  { code: 'SG', label: 'SG', name: '新加坡', flag: '🇸🇬', currency: 'SGD', locale: 'en-SG', regionLabel: '地区', uppercase: true, titles: [], rate: 29, fee: 1200 },
  { code: 'CA', label: 'CA', name: '加拿大', flag: '🇨🇦', currency: 'CAD', locale: 'en-CA', regionLabel: '省 / 地区', uppercase: false, titles: ['Mr', 'Mrs', 'Ms'], rate: 15, fee: 2300 },
  { code: 'MY', label: 'MY', name: '马来西亚', flag: '🇲🇾', currency: 'MYR', locale: 'en-MY', regionLabel: '州 / 地区', uppercase: true, titles: [], rate: 35, fee: 1600 },
  { code: 'PH', label: 'PH', name: '菲律宾', flag: '🇵🇭', currency: 'PHP', locale: 'en-PH', regionLabel: '省 / 地区', uppercase: true, titles: [], rate: 1080, fee: 12000 },
  { code: 'NZ', label: 'NZ', name: '新西兰', flag: '🇳🇿', currency: 'NZD', locale: 'en-NZ', regionLabel: '地区', uppercase: true, titles: [], rate: 31, fee: 2700 },
  { code: 'DE', label: 'DE', name: '德国', flag: '🇩🇪', currency: 'EUR', locale: 'de-DE', regionLabel: '州 / 地区', uppercase: false, titles: ['Herr', 'Frau'], rate: 34, fee: 1800 },
  { code: 'IT', label: 'IT', name: '意大利', flag: '🇮🇹', currency: 'EUR', locale: 'it-IT', regionLabel: '省 / 地区', uppercase: true, titles: [], rate: 28, fee: 2100 },
  { code: 'JP', label: 'JP', name: '日本', flag: '🇯🇵', currency: 'JPY', locale: 'ja-JP', regionLabel: '都道府县', uppercase: true, titles: [], rate: 31, fee: 930 },
]

// Reference labels describe the selected layout; documents use fictional issuers.
export const billTemplates: BillTemplate[] = [
  { id: 'gb-water', country: 'GB', name: '水费｜Yorkshire', issuer: 'Northfield Water', kind: 'water', color: '#154c80', pale: '#edf4fa', layout: 'classic' },
  { id: 'gb-electricity', country: 'GB', name: '电费｜British Gas', issuer: 'Bluehaven Energy', kind: 'electricity', color: '#166ba2', pale: '#edf7fc', layout: 'split' },
  { id: 'hk-water', country: 'HK', name: '水费｜水务署 WSD', issuer: 'Harbour Water Services', kind: 'water', color: '#264e78', pale: '#f1f5fa', layout: 'ledger' },
  { id: 'hk-electricity', country: 'HK', name: '电费｜中电 CLP', issuer: 'Harbour Electric', kind: 'electricity', color: '#567d2c', pale: '#f2f5e7', layout: 'split' },
  { id: 'au-electricity', country: 'AU', name: '电费｜Alinta Energy', issuer: 'Southern Coast Energy', kind: 'electricity', color: '#ba5c2a', pale: '#fcf2e9', layout: 'band' },
  { id: 'us-electricity', country: 'US', name: '电费｜PG&E', issuer: 'Pacific Valley Energy', kind: 'electricity', color: '#187a9d', pale: '#ecf6fa', layout: 'classic' },
  { id: 'sg-electricity', country: 'SG', name: '电费｜Senoko', issuer: 'Garden City Power', kind: 'electricity', color: '#aa3345', pale: '#fcf0f1', layout: 'band' },
  { id: 'ca-electricity', country: 'CA', name: '电费｜Hydro', issuer: 'Maple River Hydro', kind: 'electricity', color: '#315e48', pale: '#eef5ef', layout: 'classic' },
  { id: 'my-electricity', country: 'MY', name: '电费｜TNB', issuer: 'Meridian Energy', kind: 'electricity', color: '#31578a', pale: '#eff3fa', layout: 'ledger' },
  { id: 'ph-electricity', country: 'PH', name: '电费｜BENECO', issuer: 'Highland Electric', kind: 'electricity', color: '#775537', pale: '#f8f2e9', layout: 'ledger' },
  { id: 'nz-electricity', country: 'NZ', name: '电费｜Mercury', issuer: 'Fern Valley Energy', kind: 'electricity', color: '#84651d', pale: '#faf5e5', layout: 'split' },
  { id: 'de-electricity', country: 'DE', name: '电费｜GREEN', issuer: 'Wiesenstrom', kind: 'electricity', color: '#45734b', pale: '#f0f6ea', layout: 'band' },
  { id: 'it-electricity', country: 'IT', name: '电费｜A2A Energia', issuer: 'Lucechiara Energia', kind: 'electricity', color: '#735082', pale: '#f6eff8', layout: 'split' },
  { id: 'jp-electricity', country: 'JP', name: '电费｜TEPCO', issuer: 'Sakura Electric', kind: 'electricity', color: '#285c79', pale: '#eef5f7', layout: 'ledger' },
]

export function secureBillRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
}
const integer = (random: () => number, low: number, high: number) => low + Math.floor(random() * (high - low + 1))
const pick = <T>(items: T[], random: () => number) => items[integer(random, 0, items.length - 1)]

export function formatBillName(name: string, country: BillCountry) {
  const clean = name.trim().replace(/\s+/g, ' ')
  return country.uppercase ? clean.toLocaleUpperCase() : clean.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (part) => part.toLocaleUpperCase())
}

export function randomBillName(country: BillCountry, title = '', random = secureBillRandom) {
  const female = ['Mrs', 'Ms', 'Frau'].includes(title)
  const first = country.code === 'JP'
    ? pick(female ? ['Yui', 'Aoi', 'Misaki', 'Rin'] : ['Ren', 'Haru', 'Minato', 'Itsuki'], random)
    : pick(female ? ['Emma', 'Olivia', 'Amelia', 'Sophie', 'Isabella'] : ['Alex', 'Oliver', 'Daniel', 'James', 'Thomas'], random)
  const last = pick(country.code === 'JP' ? ['Sato', 'Suzuki', 'Takahashi', 'Tanaka'] : country.code === 'HK' ? ['Chan', 'Wong', 'Lee', 'Leung'] : ['Morgan', 'Taylor', 'Wilson', 'Martin', 'Walker'], random)
  return formatBillName(`${first} ${last}`, country)
}

export function randomBillAddress(country: BillCountry, pack: AddressDataPack, random = secureBillRandom): Omit<BillForm, 'title' | 'name'> {
  // Keep the address fields readable in the Latin-script reference layouts.
  if (country.code === 'HK') {
    const location = pick([
      ['Nathan Road', 'Kowloon', 'Yau Tsim Mong'],
      ["Queen's Road Central", 'Hong Kong', 'Central and Western'],
      ['Sha Tin Centre Street', 'Sha Tin', 'New Territories'],
      ['Castle Peak Road', 'Tsuen Wan', 'New Territories'],
    ], random)
    return { address1: `${integer(random, 1, 188)} ${location[0]}`, address2: `Flat ${integer(random, 1, 28)}B`, city: location[1], region: location[2], postalCode: '' }
  }
  if (country.code === 'JP') {
    const location = pick([
      ['Marunouchi', 'Chiyoda-ku', 'Tokyo', '100-0005'],
      ['Umeda', 'Osaka-shi', 'Osaka', '530-0001'],
      ['Hakata', 'Fukuoka-shi', 'Fukuoka', '812-0011'],
    ], random)
    return { address1: `${integer(random, 1, 5)}-${integer(random, 1, 18)}-${integer(random, 1, 9)} ${location[0]}`, address2: '', city: location[1], region: location[2], postalCode: location[3] }
  }
  const profile = generateAddressProfiles(addressCountries.find((item) => item.code === country.code)!, pack, { gender: 'any', ageRange: 'any', count: 1 })[0]
  return { address1: profile.address.street, address2: '', city: profile.address.city, region: profile.address.region, postalCode: profile.address.postalCode }
}

export function normalizeBillForm(form: BillForm): BillForm {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim().replace(/\s+/g, ' ')])) as unknown as BillForm
}

export function validateBillForm(form: BillForm, country: BillCountry): Partial<Record<keyof BillForm, string>> {
  const errors: Partial<Record<keyof BillForm, string>> = {}
  const clean = normalizeBillForm(form)
  if (/[\p{Script=Han}]/u.test(clean.name)) errors.name = '姓名请使用非中文字符，可填写拼音或英文'
  if (clean.name && !/\p{L}/u.test(clean.name)) errors.name = '姓名至少需要包含一个字母'
  if (!clean.address1) errors.address1 = '请填写地址第 1 行，或点击随机填充'
  if (!clean.city) errors.city = '请填写城市'
  if (country.code !== 'HK' && !isValidAddressPostalCode(country.code, clean.postalCode.toUpperCase())) errors.postalCode = '请填写符合所选国家格式的邮编'
  for (const key of Object.keys(clean) as (keyof BillForm)[]) {
    const limit = { name: 70, address1: 90, address2: 90, city: 60, region: 60, postalCode: 16, title: 8 }[key]
    if (clean[key].length > limit) errors[key] = `最多输入 ${limit} 个字符`
    if (/[\u0000-\u001f\u007f]/.test(form[key])) errors[key] = '请移除换行或控制字符'
  }
  return errors
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const plusDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)

export function createUtilityBill(country: BillCountry, template: BillTemplate, form: BillForm, now = new Date(), random = secureBillRandom): UtilityBill {
  if (template.country !== country.code) throw new Error('账单模板与国家不匹配')
  const errors = validateBillForm(form, country)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const customer = normalizeBillForm(form)
  customer.name ||= randomBillName(country, customer.title, random)
  customer.postalCode = customer.postalCode.toUpperCase()
  if (!country.titles.includes(customer.title)) customer.title = ''
  const issued = plusDays(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())), -integer(random, 0, 10))
  const days = integer(random, 28, 33)
  const periodEnd = plusDays(issued, -integer(random, 1, 4))
  const usage = integer(random, template.kind === 'water' ? 12 : 160, template.kind === 'water' ? 48 : 640)
  const rateMinor = template.kind === 'water' ? country.rate * 7 : country.rate
  const fee = country.fee + integer(random, 0, 8) * (country.currency === 'JPY' ? 10 : 100)
  const lines: BillLine[] = [
    { label: template.kind === 'water' ? 'Water supply' : 'Electricity supply', quantity: usage, unit: template.kind === 'water' ? 'm³' : 'kWh', rateMinor, amountMinor: usage * rateMinor },
    { label: 'Service charge', quantity: 1, unit: 'period', rateMinor: fee, amountMinor: fee },
  ]
  if (template.kind === 'water') lines.push({ label: 'Wastewater service', quantity: usage, unit: 'm³', rateMinor: Math.round(rateMinor * 0.4), amountMinor: usage * Math.round(rateMinor * 0.4) })
  const subtotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0)
  const adjustmentMinor = -integer(random, 0, 5) * (country.currency === 'JPY' ? 10 : 100)
  const readingStart = integer(random, 12000, 67000)
  const digits = () => Array.from({ length: 10 }, () => integer(random, 0, 9)).join('')
  return {
    id: `DEMO-${country.label}-${digits()}`, country, template, customer,
    issued: isoDate(issued), due: isoDate(plusDays(issued, 21)), periodStart: isoDate(plusDays(periodEnd, 1 - days)), periodEnd: isoDate(periodEnd),
    account: `S-${digits()}`, meter: `M-${digits().slice(0, 8)}`, readingStart, readingEnd: readingStart + usage, usage, unit: lines[0].unit, days,
    lines, subtotalMinor, adjustmentMinor, totalMinor: subtotalMinor + adjustmentMinor,
    history: [...Array.from({ length: 5 }, () => integer(random, Math.round(usage * 0.55), Math.round(usage * 1.45))), usage],
    photoAngle: -3 + random() * 6, photoTone: integer(random, 0, 2),
  }
}

export function billMoney(amountMinor: number, country: BillCountry) {
  return new Intl.NumberFormat(country.locale, { style: 'currency', currency: country.currency }).format((amountMinor || 0) / (country.currency === 'JPY' ? 1 : 100))
}

export function billDate(value: string, country: BillCountry) {
  return new Intl.DateTimeFormat(country.locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export function billFilename(bill: UtilityBill) {
  return `littletools-${bill.country.label.toLowerCase()}-${bill.template.kind}-${bill.id.toLowerCase()}`
}
