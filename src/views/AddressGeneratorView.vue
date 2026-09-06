<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import {
  BankOutlined,
  CopyOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import ToolCard from '../components/ToolCard.vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import {
  addressCountries,
  addressProfilesToCsv,
  generateAddressProfiles,
  loadAddressPack,
  type AddressAgeRange,
  type AddressDataPack,
  type AddressGender,
  type GeneratedAddressProfile,
} from '../utils/address'
import { parseIPv4, parseIPv6 } from '../utils/ip'

interface IpGeoResult {
  countryCode: string
  region: string
  city: string
}

const countryCode = ref('US')
const gender = ref<AddressGender>('any')
const ageRange = ref<AddressAgeRange>('any')
const region = ref('')
const city = ref('')
const count = ref(1)
const seed = ref('')
const ipInput = ref('')
const pack = shallowRef<AddressDataPack | null>(null)
const packCountryCode = ref('')
const profiles = shallowRef<GeneratedAddressProfile[]>([])
const activeIndex = ref(0)
const loading = ref(false)
const ipLoading = ref(false)
const error = ref('')
const ipMessage = ref('')
const copiedKey = ref('')
let loadSequence = 0

rememberToolSettings('address-generator', { countryCode, gender, ageRange, region, city, count, seed, ipInput })
if (!addressCountries.some((country) => country.code === countryCode.value)) countryCode.value = 'US'

const selectedCountry = computed(() => addressCountries.find((country) => country.code === countryCode.value) || addressCountries[0])
const regionOptions = computed(() => [...new Set((pack.value?.locations || []).map((location) => location.region))])
const cityOptions = computed(() => [...new Set((pack.value?.locations || [])
  .filter((location) => !region.value || location.region === region.value)
  .map((location) => location.city))])
const activeProfile = computed(() => profiles.value[activeIndex.value] || null)
const resultSections = computed(() => {
  const profile = activeProfile.value
  if (!profile) return []
  return [
    {
      key: 'basic', title: '基础信息', icon: UserOutlined, fields: [
        ['姓名', profile.basic.fullName], ['性别', profile.basic.gender], ['生日', profile.basic.birthday],
        ['年龄', `${profile.basic.age} 岁`], ['称谓', profile.basic.title], ['发色', profile.basic.hairColor],
        ['血型', profile.basic.bloodType], ['身高', profile.basic.height], ['体重', profile.basic.weight],
        ['教育程度', profile.basic.education],
      ],
    },
    {
      key: 'address', title: '地址与联系方式', icon: EnvironmentOutlined, fields: [
        ['完整地址', profile.address.fullAddress], ['街道地址', profile.address.street], ['区县 / 地区', profile.address.district],
        ['城市', profile.address.city], ['州 / 省', profile.address.region], ['州省代码', profile.address.regionCode],
        ['邮编', profile.address.postalCode || '无通用邮编'], ['国家 / 地区', profile.address.country],
        ['电话格式样例', profile.contact.phone], ['测试邮箱', profile.contact.testEmail],
      ],
    },
    {
      key: 'employment', title: '工作信息', icon: BankOutlined, fields: [
        ['职业', profile.employment.occupation], ['公司', profile.employment.company],
        ['公司规模', profile.employment.companySize], ['工作状态', profile.employment.status],
        ['月薪样例', profile.employment.salary],
      ],
    },
    {
      key: 'internet', title: '网络与扩展信息', icon: GlobalOutlined, fields: [
        ['用户名', profile.internet.username], ['密码', profile.internet.password], ['UUID', profile.internet.uuid],
        ['网站', profile.internet.website], ['User-Agent', profile.internet.userAgent],
      ],
    },
    {
      key: 'sandbox', title: '沙盒支付数据', icon: SafetyCertificateOutlined, fields: [
        ['卡类型', profile.financial.cardType], ['测试卡号', profile.financial.cardNumber],
        ['有效期', profile.financial.expiry], ['CVV', profile.financial.cvv],
      ],
    },
  ]
})

async function prepareCountry(code: string) {
  const sequence = ++loadSequence
  loading.value = true
  error.value = ''
  try {
    const loaded = await loadAddressPack(code)
    if (sequence !== loadSequence) return null
    pack.value = loaded
    packCountryCode.value = code
    if (region.value && !loaded.locations.some((location) => location.region === region.value)) region.value = ''
    if (city.value && !loaded.locations.some((location) => location.city === city.value && (!region.value || location.region === region.value))) city.value = ''
    return loaded
  } catch (reason) {
    if (sequence === loadSequence) {
      pack.value = null
      packCountryCode.value = ''
      error.value = navigator.onLine
        ? (reason instanceof Error ? reason.message : '国家数据加载失败')
        : '该国家的数据尚未缓存，请联网加载一次后再离线使用'
    }
    return null
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function generate() {
  error.value = ''
  loading.value = true
  try {
    const currentPack = packCountryCode.value === countryCode.value && pack.value
      ? pack.value
      : await prepareCountry(countryCode.value)
    if (!currentPack) return
    profiles.value = generateAddressProfiles(selectedCountry.value, currentPack, {
      gender: gender.value,
      ageRange: ageRange.value,
      region: region.value,
      city: city.value,
      count: count.value,
      seed: seed.value,
    })
    activeIndex.value = 0
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '生成失败，请重试'
  } finally {
    loading.value = false
  }
}

async function selectCountry(code: string) {
  if (countryCode.value !== code) countryCode.value = code
  region.value = ''
  city.value = ''
  profiles.value = []
  await prepareCountry(code)
  await generate()
}

function changeRegion() {
  city.value = ''
}

function moveResult(direction: -1 | 1) {
  if (!profiles.value.length) return
  activeIndex.value = (activeIndex.value + direction + profiles.value.length) % profiles.value.length
}

async function copy(value: string, key: string) {
  await navigator.clipboard.writeText(value)
  copiedKey.value = key
  window.setTimeout(() => { if (copiedKey.value === key) copiedKey.value = '' }, 1200)
}

function downloadFile(content: string, type: string, extension: string) {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `littletools-addresses-${Date.now()}.${extension}`
  link.click()
  URL.revokeObjectURL(link.href)
}

function downloadJson() {
  downloadFile(JSON.stringify(profiles.value, null, 2), 'application/json;charset=utf-8', 'json')
}

function downloadCsv() {
  downloadFile(addressProfilesToCsv(profiles.value), 'text/csv;charset=utf-8', 'csv')
}

async function fetchIpLocation(ip: string): Promise<IpGeoResult> {
  const suffix = ip ? `/${encodeURIComponent(ip)}` : ''
  try {
    const response = await fetch(`https://api.ip.sb/geoip${suffix}`)
    if (response.ok) {
      const data = await response.json() as { country_code?: string; region?: string; city?: string }
      return { countryCode: data.country_code || '', region: data.region || '', city: data.city || '' }
    }
  } catch { /* Try the fallback service. */ }
  const response = await fetch(`https://ipwho.is/${ip ? encodeURIComponent(ip) : ''}`)
  if (!response.ok) throw new Error('IP 定位服务暂时不可用')
  const data = await response.json() as { success?: boolean; message?: string; country_code?: string; region?: string; city?: string }
  if (data.success === false) throw new Error(data.message || '无法识别该 IP')
  return { countryCode: data.country_code || '', region: data.region || '', city: data.city || '' }
}

function findSimilar(values: string[], target: string) {
  const normalized = target.trim().toLocaleLowerCase()
  if (!normalized) return ''
  return values.find((value) => {
    const candidate = value.toLocaleLowerCase()
    return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate)
  }) || ''
}

async function preselectByIp(useCurrent = false) {
  error.value = ''
  ipMessage.value = ''
  const ip = useCurrent ? '' : ipInput.value.trim()
  if (ip) {
    try { ip.includes(':') ? parseIPv6(ip) : parseIPv4(ip) }
    catch { error.value = '请输入有效的 IPv4 或 IPv6 地址'; return }
  }
  if (!navigator.onLine) { error.value = 'IP 预选需要联网；地址生成功能仍可离线使用'; return }
  ipLoading.value = true
  try {
    const location = await fetchIpLocation(ip)
    if (!addressCountries.some((country) => country.code === location.countryCode)) throw new Error('该 IP 所在国家暂不在支持列表中')
    countryCode.value = location.countryCode
    region.value = ''
    city.value = ''
    const loaded = await prepareCountry(location.countryCode)
    if (!loaded) return
    region.value = findSimilar([...new Set(loaded.locations.map((item) => item.region))], location.region)
    city.value = findSimilar([...new Set(loaded.locations.filter((item) => !region.value || item.region === region.value).map((item) => item.city))], location.city)
    ipMessage.value = `已根据 IP 预选 ${selectedCountry.value.name}${region.value ? ` · ${region.value}` : ''}${city.value ? ` · ${city.value}` : ''}`
    await generate()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'IP 预选失败'
  } finally {
    ipLoading.value = false
  }
}

async function initialize() {
  await prepareCountry(countryCode.value)
  await generate()
}

onMounted(() => { void initialize() })
</script>

<template>
  <ToolPageHeader title="多国地址生成器" description="按国家规范生成关联一致的虚构地址与测试资料，国家数据按需加载" :icon="EnvironmentOutlined">
    <template #extra>{{ addressCountries.length }} 个国家和地区</template>
  </ToolPageHeader>

  <ToolCard class="country-card">
    <div class="country-strip" aria-label="选择国家或地区">
      <button
        v-for="country in addressCountries"
        :key="country.code"
        :class="{ active: countryCode === country.code }"
        :aria-pressed="countryCode === country.code"
        @click="selectCountry(country.code)"
      ><span>{{ country.flag }}</span>{{ country.name }}</button>
    </div>

    <div class="generator-grid">
      <label><span>国家 / 地区</span><a-select v-model:value="countryCode" show-search option-filter-prop="label" @change="selectCountry"><a-select-option v-for="country in addressCountries" :key="country.code" :value="country.code" :label="`${country.name} ${country.englishName}`">{{ country.flag }} {{ country.name }}</a-select-option></a-select></label>
      <label><span>性别</span><a-select v-model:value="gender"><a-select-option value="any">不限</a-select-option><a-select-option value="male">男</a-select-option><a-select-option value="female">女</a-select-option></a-select></label>
      <label><span>年龄段</span><a-select v-model:value="ageRange"><a-select-option value="any">不限</a-select-option><a-select-option value="18-25">18–25</a-select-option><a-select-option value="26-35">26–35</a-select-option><a-select-option value="36-45">36–45</a-select-option><a-select-option value="46-60">46–60</a-select-option><a-select-option value="60+">60+</a-select-option></a-select></label>
      <label><span>州 / 省</span><a-select v-model:value="region" allow-clear placeholder="不限" :loading="loading" @change="changeRegion"><a-select-option v-for="item in regionOptions" :key="item" :value="item">{{ item }}</a-select-option></a-select></label>
      <label><span>城市</span><a-select v-model:value="city" allow-clear placeholder="不限" :loading="loading"><a-select-option v-for="item in cityOptions" :key="item" :value="item">{{ item }}</a-select-option></a-select></label>
      <label><span>生成数量</span><a-input-number v-model:value="count" :min="1" :max="20" /></label>
      <label class="seed-field"><span>随机种子 <small>相同种子可复现</small></span><a-input v-model:value="seed" allow-clear placeholder="可选，例如 qa-2026" /></label>
      <a-button class="generate-button" type="primary" size="large" :loading="loading" @click="generate"><ReloadOutlined />立即生成</a-button>
    </div>

    <div class="ip-prefill">
      <div><strong>基于 IP 预选</strong><span>这是可选的联网功能；地址生成本身始终在浏览器本地完成。</span></div>
      <a-input v-model:value="ipInput" allow-clear placeholder="输入 IPv4 / IPv6，或使用当前 IP" @press-enter="preselectByIp(false)" />
      <a-button :loading="ipLoading" :disabled="!ipInput.trim()" @click="preselectByIp(false)">使用这个 IP</a-button>
      <a-button :loading="ipLoading" @click="preselectByIp(true)">使用当前 IP</a-button>
    </div>
    <div v-if="ipMessage" class="ip-message">{{ ipMessage }}</div>
    <a-alert v-if="error" class="error-alert" type="error" show-icon :message="error" />
    <div class="local-note"><SafetyCertificateOutlined /> 当前国家数据包按需下载，首次使用后由浏览器缓存；不会加载完整真实地址库，也不会上传生成内容。</div>
  </ToolCard>

  <ToolCard v-if="activeProfile" class="result-card">
    <div class="result-toolbar">
      <div><span>生成结果</span><strong>{{ activeIndex + 1 }} / {{ profiles.length }}</strong><small>{{ selectedCountry.flag }} {{ selectedCountry.name }} · 虚构测试资料</small></div>
      <div class="result-actions">
        <a-button v-if="profiles.length > 1" aria-label="上一条结果" @click="moveResult(-1)"><LeftOutlined /></a-button>
        <a-button v-if="profiles.length > 1" aria-label="下一条结果" @click="moveResult(1)"><RightOutlined /></a-button>
        <a-button @click="copy(JSON.stringify(activeProfile, null, 2), 'profile')"><CopyOutlined />{{ copiedKey === 'profile' ? '已复制' : '复制本条' }}</a-button>
        <a-button @click="downloadJson"><DownloadOutlined />JSON</a-button>
        <a-button @click="downloadCsv"><DownloadOutlined />CSV</a-button>
      </div>
    </div>

    <div class="identity-head">
      <div><strong>{{ activeProfile.basic.fullName }}</strong><span>{{ activeProfile.basic.gender }} · {{ activeProfile.basic.age }} 岁 · {{ activeProfile.employment.occupation }}</span></div>
      <button @click="copy(activeProfile.address.fullAddress, 'full-address')"><EnvironmentOutlined />{{ copiedKey === 'full-address' ? '地址已复制' : '复制完整地址' }}</button>
    </div>

    <div class="profile-sections">
      <section v-for="section in resultSections" :key="section.key">
        <h3><component :is="section.icon" />{{ section.title }}</h3>
        <div class="field-list">
          <div v-for="([label, value], fieldIndex) in section.fields" :key="label" :class="{ wide: label === '完整地址' || label === 'User-Agent', mono: section.key === 'internet' || section.key === 'sandbox' }">
            <span>{{ label }}</span>
            <strong>{{ value }}</strong>
            <button :aria-label="`复制${label}`" @click="copy(String(value), `${section.key}-${fieldIndex}`)"><CopyOutlined />{{ copiedKey === `${section.key}-${fieldIndex}` ? '已复制' : '' }}</button>
          </div>
        </div>
      </section>
    </div>

    <div class="sandbox-warning"><SafetyCertificateOutlined /><span><strong>仅限开发与测试</strong>地址并非真实收件地址；邮箱使用保留域名，银行卡为公开沙盒测试号码，不能用于真实交易或身份验证。</span></div>
  </ToolCard>
</template>

<style scoped>
.country-card { padding: 0; overflow: hidden; }
.country-strip { display: flex; flex-wrap: wrap; gap: 7px; padding: 16px; border-bottom: 1px solid var(--line); background: var(--panel-subtle); }
.country-strip button { display: inline-flex; min-height: 32px; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel-bg); color: var(--text-main); font-size: 12px; cursor: pointer; transition: border-color .15s, background .15s, color .15s; }
.country-strip button:hover { border-color: var(--accent-text); }
.country-strip button.active { border-color: color-mix(in srgb, var(--primary-color) 60%, var(--line)); background: color-mix(in srgb, var(--primary-color) 10%, var(--panel-bg)); color: var(--accent-text); font-weight: 600; }
.country-strip button span { font-size: 15px; }
.generator-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding: 20px 18px; }
.generator-grid label { display: flex; min-width: 0; flex-direction: column; gap: 7px; }
.generator-grid label > span { color: var(--text-muted); font-size: 12px; font-weight: 600; letter-spacing: .03em; }
.generator-grid label small { margin-left: 5px; font-weight: 400; }
.generator-grid :deep(.ant-select), .generator-grid :deep(.ant-input-number) { width: 100%; }
.seed-field { grid-column: span 2; }
.generate-button { align-self: end; }
.ip-prefill { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 9px; margin: 0 18px 16px; padding-top: 18px; border-top: 1px solid var(--line); }
.ip-prefill > div { grid-column: 1 / -1; display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.ip-prefill strong { color: var(--text-main); font-size: 12px; }
.ip-prefill span { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.ip-message { margin: -6px 18px 14px; color: var(--accent-text); font-size: 12px; }
.error-alert { margin: 0 18px 14px; }
.local-note { display: flex; align-items: flex-start; gap: 7px; margin: 0 18px 18px; color: var(--text-muted); font-size: 12px; line-height: 1.55; }
.local-note > :first-child { flex: 0 0 auto; margin-top: 2px; color: var(--accent-text); }
.result-card { padding: 0; overflow: hidden; }
.result-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--line); background: var(--panel-subtle); }
.result-toolbar > div:first-child { display: grid; grid-template-columns: auto auto; align-items: baseline; gap: 3px 8px; }
.result-toolbar span { color: var(--text-muted); font-size: 12px; font-weight: 600; }
.result-toolbar strong { font-variant-numeric: tabular-nums; font-size: 12px; }
.result-toolbar small { grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; }
.result-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.identity-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 13px; padding: 18px; border-bottom: 1px solid var(--line); }
.identity-head > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.identity-head strong { overflow-wrap: anywhere; color: var(--text-main); font-size: 17px; }
.identity-head div span { color: var(--text-muted); font-size: 12px; }
.identity-head button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border: 0; border-radius: 6px; background: var(--panel-subtle); color: var(--accent-text); font-size: 12px; cursor: pointer; }
.profile-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.profile-sections section { min-width: 0; padding: 18px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.profile-sections section:nth-child(2n) { border-right: 0; }
.profile-sections section:last-child { grid-column: 1 / -1; border-right: 0; }
.profile-sections h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 12px; color: var(--text-main); font-size: 12px; }
.profile-sections h3 > :first-child { color: var(--accent-text); }
.field-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.field-list > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; min-width: 0; align-content: start; gap: 3px 8px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.field-list > div.wide { grid-column: 1 / -1; }
.field-list span { grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; }
.field-list strong { min-width: 0; overflow-wrap: anywhere; color: var(--text-main); font-family: inherit; font-size: 13px; font-weight: 500; line-height: 1.55; }
.field-list button { align-self: start; min-width: 28px; min-height: 28px; padding: 3px; border: 0; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; }
.field-list button:hover { color: var(--accent-text); }
.sandbox-warning { display: flex; align-items: flex-start; gap: 9px; margin: 16px 18px; padding: 0; color: var(--text-muted); font-size: 12px; line-height: 1.55; }
.sandbox-warning > :first-child { flex: 0 0 auto; margin-top: 2px; color: var(--text-muted); }
.sandbox-warning strong { display: block; color: var(--text-main); font-size: 12px; }
@container (max-width: 900px) { .profile-sections { grid-template-columns: minmax(0, 1fr); } .profile-sections section { border-right: 0; } }
@container (max-width: 700px) { .country-strip { flex-wrap: nowrap; overflow-x: auto; } .country-strip button { flex: 0 0 auto; } .generator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .result-toolbar { align-items: flex-start; flex-direction: column; } .result-actions { width: 100%; justify-content: flex-start; } }
@container (max-width: 480px) { .generator-grid, .ip-prefill { grid-template-columns: minmax(0, 1fr); } .seed-field { grid-column: auto; } .identity-head { grid-template-columns: minmax(0, 1fr); } .identity-head > button { justify-content: center; } .field-list { grid-template-columns: minmax(0, 1fr); } }
</style>
