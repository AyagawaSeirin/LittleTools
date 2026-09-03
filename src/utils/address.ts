export type AddressGender = 'any' | 'male' | 'female'
export type AddressAgeRange = 'any' | '18-25' | '26-35' | '36-45' | '46-60' | '60+'

export interface AddressCountry {
  code: string
  name: string
  englishName: string
  flag: string
  currency: string
  phoneTemplate: string
  salaryRange: [number, number]
  familyFirst?: boolean
  compactName?: boolean
}

export interface AddressLocation {
  region: string
  regionCode: string
  city: string
  district: string
  postalCode: string
}

export interface AddressDataPack {
  male: string[]
  female: string[]
  last: string[]
  streets: string[]
  suffixes: string[]
  companies: string[]
  locations: AddressLocation[]
}

export interface AddressGenerateOptions {
  gender: AddressGender
  ageRange: AddressAgeRange
  region?: string
  city?: string
  count: number
  seed?: string
}

export interface GeneratedAddressProfile {
  id: string
  basic: {
    fullName: string
    gender: '男' | '女'
    birthday: string
    age: number
    title: '先生' | '女士'
    hairColor: string
    bloodType: string
    height: string
    weight: string
    education: string
  }
  address: AddressLocation & {
    street: string
    country: string
    fullAddress: string
  }
  contact: {
    phone: string
    testEmail: string
  }
  employment: {
    occupation: string
    company: string
    companySize: string
    status: string
    salary: string
  }
  financial: {
    cardType: string
    cardNumber: string
    expiry: string
    cvv: string
    testOnly: true
  }
  internet: {
    username: string
    password: string
    uuid: string
    website: string
    userAgent: string
  }
}

export const addressCountries: AddressCountry[] = [
  { code: 'US', name: '美国', englishName: 'United States', flag: '🇺🇸', currency: 'USD', phoneTemplate: '+1 202-555-01##', salaryRange: [3200, 9800] },
  { code: 'CA', name: '加拿大', englishName: 'Canada', flag: '🇨🇦', currency: 'CAD', phoneTemplate: '+1 416-555-01##', salaryRange: [3500, 9000] },
  { code: 'AU', name: '澳大利亚', englishName: 'Australia', flag: '🇦🇺', currency: 'AUD', phoneTemplate: '+61 4## ### ###', salaryRange: [4200, 10500] },
  { code: 'JP', name: '日本', englishName: 'Japan', flag: '🇯🇵', currency: 'JPY', phoneTemplate: '+81 90-####-####', salaryRange: [240000, 780000], familyFirst: true, compactName: true },
  { code: 'TW', name: '中国台湾', englishName: 'Taiwan', flag: '🇹🇼', currency: 'TWD', phoneTemplate: '+886 9##-###-###', salaryRange: [32000, 120000], familyFirst: true, compactName: true },
  { code: 'KR', name: '韩国', englishName: 'South Korea', flag: '🇰🇷', currency: 'KRW', phoneTemplate: '+82 10-####-####', salaryRange: [2400000, 7500000], familyFirst: true, compactName: true },
  { code: 'HK', name: '中国香港', englishName: 'Hong Kong', flag: '🇭🇰', currency: 'HKD', phoneTemplate: '+852 5### ####', salaryRange: [18000, 78000], familyFirst: true, compactName: true },
  { code: 'GB', name: '英国', englishName: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', phoneTemplate: '+44 7700 900###', salaryRange: [2200, 7200] },
  { code: 'DE', name: '德国', englishName: 'Germany', flag: '🇩🇪', currency: 'EUR', phoneTemplate: '+49 151 #### ####', salaryRange: [2600, 7800] },
  { code: 'SG', name: '新加坡', englishName: 'Singapore', flag: '🇸🇬', currency: 'SGD', phoneTemplate: '+65 8### ####', salaryRange: [3200, 12000] },
  { code: 'FR', name: '法国', englishName: 'France', flag: '🇫🇷', currency: 'EUR', phoneTemplate: '+33 6 ## ## ## ##', salaryRange: [2200, 6800] },
  { code: 'IT', name: '意大利', englishName: 'Italy', flag: '🇮🇹', currency: 'EUR', phoneTemplate: '+39 320 ### ####', salaryRange: [1800, 5800] },
  { code: 'ES', name: '西班牙', englishName: 'Spain', flag: '🇪🇸', currency: 'EUR', phoneTemplate: '+34 6## ### ###', salaryRange: [1800, 5600] },
  { code: 'NL', name: '荷兰', englishName: 'Netherlands', flag: '🇳🇱', currency: 'EUR', phoneTemplate: '+31 6 #### ####', salaryRange: [2800, 8200] },
  { code: 'MY', name: '马来西亚', englishName: 'Malaysia', flag: '🇲🇾', currency: 'MYR', phoneTemplate: '+60 12-### ####', salaryRange: [2800, 13000] },
  { code: 'RU', name: '俄罗斯', englishName: 'Russia', flag: '🇷🇺', currency: 'RUB', phoneTemplate: '+7 9## ###-##-##', salaryRange: [55000, 240000] },
  { code: 'CN', name: '中国', englishName: 'China', flag: '🇨🇳', currency: 'CNY', phoneTemplate: '+86 138 #### ####', salaryRange: [5000, 35000], familyFirst: true, compactName: true },
  { code: 'TH', name: '泰国', englishName: 'Thailand', flag: '🇹🇭', currency: 'THB', phoneTemplate: '+66 8# ### ####', salaryRange: [18000, 95000] },
  { code: 'PH', name: '菲律宾', englishName: 'Philippines', flag: '🇵🇭', currency: 'PHP', phoneTemplate: '+63 917 ### ####', salaryRange: [22000, 120000] },
  { code: 'AR', name: '阿根廷', englishName: 'Argentina', flag: '🇦🇷', currency: 'ARS', phoneTemplate: '+54 9 11 ####-####', salaryRange: [450000, 2200000] },
  { code: 'TR', name: '土耳其', englishName: 'Turkey', flag: '🇹🇷', currency: 'TRY', phoneTemplate: '+90 532 ### ## ##', salaryRange: [25000, 130000] },
  { code: 'VN', name: '越南', englishName: 'Vietnam', flag: '🇻🇳', currency: 'VND', phoneTemplate: '+84 91 ### ## ##', salaryRange: [9000000, 50000000], familyFirst: true },
  { code: 'BR', name: '巴西', englishName: 'Brazil', flag: '🇧🇷', currency: 'BRL', phoneTemplate: '+55 11 9####-####', salaryRange: [2500, 16000] },
  { code: 'MX', name: '墨西哥', englishName: 'Mexico', flag: '🇲🇽', currency: 'MXN', phoneTemplate: '+52 55 #### ####', salaryRange: [12000, 75000] },
  { code: 'IN', name: '印度', englishName: 'India', flag: '🇮🇳', currency: 'INR', phoneTemplate: '+91 98765 #####', salaryRange: [25000, 180000] },
  { code: 'ID', name: '印度尼西亚', englishName: 'Indonesia', flag: '🇮🇩', currency: 'IDR', phoneTemplate: '+62 812-###-####', salaryRange: [4000000, 30000000] },
  { code: 'NZ', name: '新西兰', englishName: 'New Zealand', flag: '🇳🇿', currency: 'NZD', phoneTemplate: '+64 21 ### ####', salaryRange: [3800, 9500] },
]

const countryMap = new Map(addressCountries.map((country) => [country.code, country]))
const packCache = new Map<string, Promise<AddressDataPack>>()
const dataVersion = '1'

const postalPatterns: Record<string, RegExp> = {
  US: /^\d{5}(?:-\d{4})?$/,
  CA: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
  AU: /^\d{4}$/,
  JP: /^\d{3}-\d{4}$/,
  TW: /^\d{3,6}$/,
  KR: /^\d{5}$/,
  HK: /^$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
  DE: /^\d{5}$/,
  SG: /^\d{6}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  NL: /^\d{4} [A-Z]{2}$/,
  MY: /^\d{5}$/,
  RU: /^\d{6}$/,
  CN: /^\d{6}$/,
  TH: /^\d{5}$/,
  PH: /^\d{4}$/,
  AR: /^[A-Z]\d{4}[A-Z]{3}$/,
  TR: /^\d{5}$/,
  VN: /^\d{5}$/,
  BR: /^\d{5}-\d{3}$/,
  MX: /^\d{5}$/,
  IN: /^[1-9]\d{5}$/,
  ID: /^\d{5}$/,
  NZ: /^\d{4}$/,
}

export function isValidAddressPostalCode(countryCode: string, value: string) {
  return Boolean(postalPatterns[countryCode]?.test(value))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')
}

export function validateAddressPack(value: unknown): value is AddressDataPack {
  if (!value || typeof value !== 'object') return false
  const pack = value as AddressDataPack
  if (![pack.male, pack.female, pack.last, pack.streets, pack.suffixes, pack.companies].every(isStringArray)) return false
  return Array.isArray(pack.locations) && pack.locations.length > 0 && pack.locations.every((location) => (
    location && ['region', 'regionCode', 'city', 'district', 'postalCode'].every((key) => typeof location[key as keyof AddressLocation] === 'string')
  ))
}

export async function loadAddressPack(countryCode: string) {
  const code = countryCode.toUpperCase()
  if (!countryMap.has(code)) throw new Error('暂不支持该国家或地区')
  if (!packCache.has(code)) {
    const root = new URL(import.meta.env.BASE_URL, window.location.href)
    const url = new URL(`address-data/${code.toLowerCase()}.json?v=${dataVersion}`, root)
    packCache.set(code, fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`国家数据加载失败（${response.status}）`)
      const pack = await response.json() as unknown
      if (!validateAddressPack(pack)) throw new Error('国家数据格式无效')
      if (pack.locations.some((location) => !isValidAddressPostalCode(code, location.postalCode))) {
        throw new Error('国家数据中的邮编格式无效')
      }
      return pack
    }).catch((error) => {
      packCache.delete(code)
      throw error
    }))
  }
  return packCache.get(code)!
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomFromSeed(seed: number) {
  let state = seed
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function secureRandom() {
  const value = new Uint32Array(1)
  return () => {
    crypto.getRandomValues(value)
    return value[0] / 4294967296
  }
}

function integer(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

function pick<T>(values: readonly T[], random: () => number) {
  return values[integer(random, 0, values.length - 1)]
}

function replaceDigits(template: string, random: () => number) {
  return template.replace(/#/g, () => String(integer(random, 0, 9)))
}

function uuid(random: () => number) {
  const bytes = Array.from({ length: 16 }, () => integer(random, 0, 255))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function ageBounds(range: AddressAgeRange): [number, number] {
  if (range === '18-25') return [18, 25]
  if (range === '26-35') return [26, 35]
  if (range === '36-45') return [36, 45]
  if (range === '46-60') return [46, 60]
  if (range === '60+') return [60, 78]
  return [18, 70]
}

function birthDateForAge(age: number, random: () => number, now: Date) {
  const dayMs = 86_400_000
  const boundary = (yearsAgo: number) => {
    const year = now.getUTCFullYear() - yearsAgo
    const month = now.getUTCMonth()
    const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
    return Date.UTC(year, month, day)
  }
  const earliest = boundary(age + 1) + dayMs
  const latest = boundary(age)
  const days = Math.max(0, Math.floor((latest - earliest) / dayMs))
  return new Date(earliest + integer(random, 0, days) * dayMs)
}

function calculateAge(birthDate: Date, now: Date) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
  if (now.getUTCMonth() < birthDate.getUTCMonth() || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())) age -= 1
  return age
}

function makeStreet(countryCode: string, pack: AddressDataPack, random: () => number) {
  const name = pick(pack.streets, random)
  const suffix = pick(pack.suffixes, random)
  const house = integer(random, 1, 988)
  if (countryCode === 'CN') return `${name}${house}号`
  if (countryCode === 'TW' || countryCode === 'HK') return `${name}${house}號`
  if (countryCode === 'JP') return `${name}${integer(random, 1, 9)}丁目${integer(random, 1, 20)}番${integer(random, 1, 12)}号`
  if (countryCode === 'KR') return `${name} ${house}`
  if (countryCode === 'RU') return `${suffix} ${name}, д. ${house}`
  if (countryCode === 'TR') return `${name} ${suffix} No:${house}`
  if (countryCode === 'DE' || countryCode === 'NL') return `${name}${suffix} ${house}`
  if (['FR', 'IT', 'ES', 'MY', 'TH', 'AR', 'VN', 'BR', 'MX', 'ID'].includes(countryCode)) return `${suffix} ${name} ${house}`
  return `${house} ${name} ${suffix}`.replace(/\s+/g, ' ').trim()
}

function compactUnique(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index)
}

function fullAddress(country: AddressCountry, location: AddressLocation, street: string) {
  if (country.code === 'CN') return `${location.region}${location.city === location.region ? '' : location.city}${location.district}${street} ${location.postalCode}`
  if (country.code === 'TW') return `${location.postalCode} ${location.region}${location.city === location.region ? '' : location.city}${location.district}${street}`
  if (country.code === 'JP') return `〒${location.postalCode} ${location.region}${location.city}${location.district}${street}`
  if (country.code === 'KR') return `${location.postalCode} ${compactUnique([location.region, location.city, location.district]).join(' ')} ${street}`
  if (country.code === 'HK') return `${compactUnique([location.region, location.city, location.district]).join(' ')} ${street}`
  if (country.code === 'SG') return `${street}, ${location.district}, Singapore ${location.postalCode}`
  const administrative = compactUnique([location.district, location.city, location.regionCode || location.region]).join(', ')
  return `${street}, ${administrative} ${location.postalCode}, ${country.englishName}`.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ')
}

function slug(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
}

function password(random: () => number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  return Array.from({ length: 14 }, () => chars[integer(random, 0, chars.length - 1)]).join('')
}

const occupations = ['软件工程师', '产品经理', '数据分析师', '设计师', '财务专员', '运营经理', '网络工程师', '研究员']
const companySizes = ['1–10 人', '11–50 人', '51–200 人', '201–500 人', '500 人以上']
const employmentStatuses = ['全职', '兼职', '自由职业', '个体经营']
const educations = ['高中', '专科', '本科', '硕士', '博士']
const hairColors = ['黑色', '深棕色', '棕色', '浅棕色']
const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-']
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/149.0.0.0 Mobile Safari/537.36',
]
const sandboxCards = [
  { cardType: 'Visa 测试卡', cardNumber: '4242 4242 4242 4242' },
  { cardType: 'Mastercard 测试卡', cardNumber: '5555 5555 5555 4444' },
]

export function generateAddressProfiles(
  country: AddressCountry,
  pack: AddressDataPack,
  options: AddressGenerateOptions,
  now = new Date(),
) {
  const eligible = pack.locations.filter((location) => (
    (!options.region || location.region === options.region) && (!options.city || location.city === options.city)
  ))
  if (!eligible.length) throw new Error('当前筛选条件没有可用的地区数据')
  const total = Math.min(50, Math.max(1, Math.floor(options.count)))
  return Array.from({ length: total }, (_, index): GeneratedAddressProfile => {
    const random = options.seed?.trim()
      ? randomFromSeed(hashSeed(`${country.code}:${options.seed.trim()}:${index}`))
      : secureRandom()
    const gender = options.gender === 'any' ? (random() < 0.5 ? 'male' : 'female') : options.gender
    const firstName = pick(gender === 'male' ? pack.male : pack.female, random)
    const lastName = pick(pack.last, random)
    const separator = country.compactName ? '' : ' '
    const fullName = country.familyFirst ? `${lastName}${separator}${firstName}` : `${firstName}${separator}${lastName}`
    const [minimumAge, maximumAge] = ageBounds(options.ageRange)
    const requestedAge = integer(random, minimumAge, maximumAge)
    const birthDate = birthDateForAge(requestedAge, random, now)
    const age = calculateAge(birthDate, now)
    const location = pick(eligible, random)
    const street = makeStreet(country.code, pack, random)
    const usernameBase = slug(fullName) || `${country.code.toLowerCase()}.user`
    const suffix = String(integer(random, 10, 9999)).padStart(4, '0')
    const card = pick(sandboxCards, random)
    const expiryMonth = String(integer(random, 1, 12)).padStart(2, '0')
    const expiryYear = String(now.getUTCFullYear() + integer(random, 2, 5)).slice(-2)
    const salary = integer(random, country.salaryRange[0], country.salaryRange[1])
    const height = integer(random, gender === 'male' ? 162 : 150, gender === 'male' ? 195 : 182)
    const weight = integer(random, Math.max(45, Math.round((height / 100) ** 2 * 19)), Math.min(110, Math.round((height / 100) ** 2 * 30)))
    return {
      id: uuid(random),
      basic: {
        fullName,
        gender: gender === 'male' ? '男' : '女',
        birthday: birthDate.toISOString().slice(0, 10),
        age,
        title: gender === 'male' ? '先生' : '女士',
        hairColor: pick(hairColors, random),
        bloodType: pick(bloodTypes, random),
        height: `${height} cm`,
        weight: `${weight} kg`,
        education: pick(educations, random),
      },
      address: { ...location, street, country: country.name, fullAddress: fullAddress(country, location, street) },
      contact: {
        phone: replaceDigits(country.phoneTemplate, random),
        testEmail: `${usernameBase}.${suffix}@example.test`,
      },
      employment: {
        occupation: pick(occupations, random),
        company: pick(pack.companies, random),
        companySize: pick(companySizes, random),
        status: pick(employmentStatuses, random),
        salary: `${salary.toLocaleString('en-US')} ${country.currency}/月`,
      },
      financial: {
        ...card,
        expiry: `${expiryMonth}/${expiryYear}`,
        cvv: String(integer(random, 0, 999)).padStart(3, '0'),
        testOnly: true,
      },
      internet: {
        username: `${usernameBase}${suffix.slice(-2)}`.slice(0, 30),
        password: password(random),
        uuid: uuid(random),
        website: `https://${usernameBase.replaceAll('.', '-')}-${suffix}.example`,
        userAgent: pick(userAgents, random),
      },
    }
  })
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function addressProfilesToCsv(profiles: GeneratedAddressProfile[]) {
  const headers = ['ID', '姓名', '性别', '生日', '年龄', '街道', '区县', '城市', '州省', '州省代码', '邮编', '国家地区', '完整地址', '电话', '测试邮箱', '职业', '公司', '薪资', '用户名', 'UUID']
  const rows = profiles.map((profile) => [
    profile.id, profile.basic.fullName, profile.basic.gender, profile.basic.birthday, profile.basic.age,
    profile.address.street, profile.address.district, profile.address.city, profile.address.region,
    profile.address.regionCode, profile.address.postalCode, profile.address.country, profile.address.fullAddress,
    profile.contact.phone, profile.contact.testEmail, profile.employment.occupation, profile.employment.company,
    profile.employment.salary, profile.internet.username, profile.internet.uuid,
  ])
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}
