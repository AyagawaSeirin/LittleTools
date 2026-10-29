<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { DownloadOutlined, ExpandOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { loadAddressPack } from '../utils/address'
import { utilityBillSources } from '../data/utilityBillSources'
import {
  billCountries, billTemplates, billFilename, billMoney, createUtilityBill, formatBillName,
  randomBillAddress, randomBillName, validateBillForm, type BillForm, type UtilityBill,
} from '../utils/utilityBill'
import {
  createBillPdf, createBillZip, downloadBillBlob, rasterizeBill, renderBillPhotoSvg, renderBillSvg,
} from '../utils/utilityBillRender'

const blankForm = (): BillForm => ({ title: 'Mr', name: '', address1: '', address2: '', city: '', region: '', postalCode: '' })
const countryCode = ref('GB')
const templateId = ref('gb-water')
const addressMode = ref('random')
const form = ref<BillForm>(blankForm())
rememberToolSettings('utility-bill', { countryCode, templateId, addressMode, form }, {
  form: { deserialize: (value: unknown) => Object.fromEntries(Object.entries(blankForm()).map(([key, fallback]) => [key, value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string' ? (value as Record<string, string>)[key].slice(0, 100) : fallback])) },
})
if (!billCountries.some((item) => item.code === countryCode.value)) countryCode.value = 'GB'
if (!billTemplates.some((item) => item.id === templateId.value && item.country === countryCode.value)) templateId.value = billTemplates.find((item) => item.country === countryCode.value)!.id
if (!['random', 'manual'].includes(addressMode.value)) addressMode.value = 'random'
const country = computed(() => billCountries.find((item) => item.code === countryCode.value)!)
const templates = computed(() => billTemplates.filter((item) => item.country === countryCode.value))
const selectedTemplate = computed(() => templates.value.find((item) => item.id === templateId.value)!)
const selectedSource = computed(() => utilityBillSources[templateId.value])
const templateThumbnails = computed(() => {
  const postalCodes: Record<string, string> = { GB: 'SW1A 2AA', HK: '', AU: '2000', US: '94105', SG: '238801', CA: 'V6B 5A1', MY: '50000', PH: '2600', NZ: '1010', DE: '10115', IT: '20121', JP: '100-0005' }
  const sample = { title: '', name: 'Alex Morgan', address1: '12 Example Street', address2: '', city: 'Sample City', region: '', postalCode: postalCodes[country.value.code] }
  return Object.fromEntries(templates.value.map((template) => {
    const bill = createUtilityBill(country.value, template, sample, new Date(2026, 9, 1), () => 0.42)
    return [template.id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderBillSvg(bill))}`]
  }))
})
if (!country.value.titles.includes(form.value.title)) form.value.title = country.value.titles[0] || ''
const loadingAddress = ref(false)
const generating = ref(false)
const exporting = ref(false)
const error = ref('')
const notice = ref('')
const errors = ref<Partial<Record<keyof BillForm, string>>>({})
const previewMode = ref<'main' | 'photo'>('main')
const fullscreen = ref(false)
const originalSize = ref(false)
const includeMain = ref(true)
const includePhoto = ref(true)
interface BillOutput { bill: UtilityBill; main: Blob; photo: Blob; mainUrl: string; photoUrl: string; fingerprint: string }
const output = shallowRef<BillOutput | null>(null)
const fingerprint = computed(() => JSON.stringify([countryCode.value, templateId.value, form.value]))
const stale = computed(() => output.value !== null && output.value.fingerprint !== fingerprint.value)
const previewUrl = computed(() => previewMode.value === 'main' ? output.value?.mainUrl : output.value?.photoUrl)
let addressSequence = 0
let generationSequence = 0
let disposed = false

function clearOutput() {
  if (output.value) { URL.revokeObjectURL(output.value.mainUrl); URL.revokeObjectURL(output.value.photoUrl) }
  output.value = null
  fullscreen.value = false
}

async function fillAddress() {
  const sequence = ++addressSequence
  const selectedCountry = country.value
  loadingAddress.value = true
  error.value = ''
  try {
    const pack = await loadAddressPack(selectedCountry.code)
    if (disposed || sequence !== addressSequence) return
    Object.assign(form.value, randomBillAddress(selectedCountry, pack))
    errors.value = {}
  } catch (reason) {
    if (!disposed && sequence === addressSequence) error.value = reason instanceof Error ? `${reason.message}；可以切换为手动填写` : '地址加载失败，请重试或手动填写'
  } finally {
    if (sequence === addressSequence) loadingAddress.value = false
  }
}

function selectCountry(code: string) {
  if (code === countryCode.value) return
  addressSequence++
  generationSequence++
  generating.value = false
  loadingAddress.value = false
  const name = form.value.name
  countryCode.value = code
  templateId.value = templates.value[0].id
  form.value = { ...blankForm(), name, title: country.value.titles[0] || '' }
  errors.value = {}
  error.value = ''
  notice.value = ''
  clearOutput()
  if (addressMode.value === 'random') void fillAddress()
}

function selectTemplate(id: string) {
  if (templateId.value === id) return
  generationSequence++
  generating.value = false
  templateId.value = id
  notice.value = ''
  clearOutput()
}

function selectMode(mode: string) {
  addressMode.value = mode
  if (mode === 'random') void fillAddress()
  else { addressSequence++; loadingAddress.value = false }
}

function editAddress() {
  addressSequence++
  loadingAddress.value = false
  addressMode.value = 'manual'
}

async function generate() {
  errors.value = validateBillForm(form.value, country.value)
  if (Object.keys(errors.value).length) {
    error.value = '请检查标出的输入项后重试'
    return
  }
  const sequence = ++generationSequence
  generating.value = true
  error.value = ''
  notice.value = ''
  try {
    const bill = createUtilityBill(country.value, selectedTemplate.value, { ...form.value })
    if (!form.value.name.trim()) form.value.name = bill.customer.name
    const snapshot = fingerprint.value
    // Wait for local fonts before rendering; image exports never use a blurred preview.
    await document.fonts.ready
    if (disposed || sequence !== generationSequence) return
    const svg = renderBillSvg(bill)
    const main = await rasterizeBill(svg, 2480, 3508, 'image/png')
    if (disposed || sequence !== generationSequence) return
    const photo = await rasterizeBill(renderBillPhotoSvg(bill, svg), 3000, 2500, 'image/jpeg')
    if (disposed || sequence !== generationSequence) return
    clearOutput()
    output.value = { bill, main, photo, mainUrl: URL.createObjectURL(main), photoUrl: URL.createObjectURL(photo), fingerprint: snapshot }
    previewMode.value = 'main'
    notice.value = '高清主图与实拍模拟图已生成'
  } catch (reason) {
    if (!disposed && sequence === generationSequence) error.value = reason instanceof Error ? reason.message : '生成失败，请重试'
  } finally {
    if (sequence === generationSequence) generating.value = false
  }
}

async function download(kind: 'png' | 'jpg' | 'pdf' | 'zip') {
  const current = output.value
  if (!current || exporting.value) return
  exporting.value = true
  error.value = ''
  try {
    const filename = billFilename(current.bill)
    if (kind === 'png') downloadBillBlob(current.main, `${filename}.png`)
    else if (kind === 'jpg') downloadBillBlob(current.photo, `${filename}-photo.jpg`)
    else if (kind === 'pdf') downloadBillBlob(await createBillPdf(current.main, current.bill), `${filename}.pdf`)
    else downloadBillBlob(await createBillZip(current.bill, current.main, current.photo, includeMain.value, includePhoto.value), `${filename}.zip`)
    if (!disposed) notice.value = '高清文件已准备好，请查看浏览器下载列表'
  } catch (reason) {
    if (!disposed) error.value = reason instanceof Error ? reason.message : '导出失败，请重试'
  } finally { exporting.value = false }
}

onMounted(() => { if (addressMode.value === 'random' && !form.value.address1) void fillAddress() })
onBeforeUnmount(() => { disposed = true; addressSequence++; generationSequence++; clearOutput() })
</script>

<template>
  <ToolPageHeader title="账单生成" description="选择账单样式、填写信息，生成高清主图与实拍模拟图" :icon="FileTextOutlined">
    <template #extra>12 个国家和地区 · 14 个模板</template>
  </ToolPageHeader>

  <div class="bill-studio">
    <section class="bill-form-panel" aria-label="账单信息">
      <div class="bill-section-heading"><h2>文档设置</h2><span>在浏览器本地生成</span></div>
      <div class="bill-field-label">选择国家 / 地区</div>
      <div class="bill-countries" aria-label="选择国家或地区">
        <button v-for="item in billCountries" :key="item.code" type="button" :aria-label="`${item.name} ${item.label}`" :aria-pressed="countryCode === item.code" :class="{ active: countryCode === item.code }" @click="selectCountry(item.code)">
          <span aria-hidden="true">{{ item.flag }}</span>{{ item.label }}
        </button>
      </div>

      <div class="bill-field-label template-label">选择模板 <span>{{ country.name }}</span></div>
      <div class="bill-templates">
        <button v-for="item in templates" :key="item.id" type="button" class="bill-template" :class="{ active: templateId === item.id }" :aria-pressed="templateId === item.id" :aria-label="`选择模板：${item.name}`" @click="selectTemplate(item.id)">
          <img class="template-paper" :src="templateThumbnails[item.id]" :alt="`${item.name}实际生成样式`" />
          <span class="template-name">{{ item.name }}</span>
        </button>
      </div>

      <div v-if="selectedSource" class="bill-layout-source">
        <p>{{ selectedSource.features }}</p>
        <a :href="selectedSource.sampleUrl || selectedSource.url" target="_blank" rel="noopener noreferrer">{{ selectedSource.title }} ↗</a>
      </div>

      <form class="bill-form" novalidate @submit.prevent="generate">
        <div class="bill-address-heading"><span class="bill-field-label">地址填写方式</span><button v-if="addressMode === 'random'" type="button" class="bill-text-button" :disabled="loadingAddress" @click="fillAddress"><ReloadOutlined /> 换一组地址</button></div>
        <div class="bill-segmented" aria-label="地址填写方式">
          <button type="button" :class="{ active: addressMode === 'random' }" :aria-pressed="addressMode === 'random'" @click="selectMode('random')">随机填充</button>
          <button type="button" :class="{ active: addressMode === 'manual' }" :aria-pressed="addressMode === 'manual'" @click="selectMode('manual')">手动填写</button>
        </div>
        <div v-if="country.titles.length" class="bill-title-field">
          <span class="bill-field-label">称谓</span>
          <label><input v-model="form.title" type="radio" name="bill-title" value="" />不使用</label>
          <label v-for="title in country.titles" :key="title"><input v-model="form.title" type="radio" name="bill-title" :value="title" />{{ title }}</label>
        </div>
        <div class="bill-input-group">
          <label for="bill-name">姓名 <span>非中文字符，留空自动生成</span></label>
          <div class="bill-name-row"><a-input id="bill-name" v-model:value="form.name" :maxlength="70" placeholder="例如 Alex Morgan" :status="errors.name ? 'error' : undefined" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'bill-name-error' : undefined" /><a-button :disabled="!form.name.trim()" @click="form.name = formatBillName(form.name, country)">{{ country.uppercase ? '全大写' : '首字母大写' }}</a-button></div>
          <div class="bill-name-tools"><button type="button" class="bill-text-button" @click="form.name = randomBillName(country, form.title)">随机姓名</button></div>
          <span v-if="errors.name" id="bill-name-error" class="bill-field-error">{{ errors.name }}</span>
        </div>
        <div class="bill-input-group">
          <label for="bill-address1">地址第 1 行</label>
          <a-input id="bill-address1" v-model:value="form.address1" :maxlength="90" placeholder="门牌号与街道" :status="errors.address1 ? 'error' : undefined" :aria-invalid="!!errors.address1" @input="editAddress" />
          <span v-if="errors.address1" class="bill-field-error">{{ errors.address1 }}</span>
        </div>
        <div class="bill-input-group">
          <label for="bill-address2">地址第 2 行 <span>选填</span></label>
          <a-input id="bill-address2" v-model:value="form.address2" :maxlength="90" placeholder="公寓、楼层、房间号" @input="editAddress" />
          <span v-if="errors.address2" class="bill-field-error">{{ errors.address2 }}</span>
        </div>
        <div class="bill-field-pair">
          <div class="bill-input-group"><label for="bill-city">城市</label><a-input id="bill-city" v-model:value="form.city" :maxlength="60" :status="errors.city ? 'error' : undefined" :aria-invalid="!!errors.city" @input="editAddress" /><span v-if="errors.city" class="bill-field-error">{{ errors.city }}</span></div>
          <div class="bill-input-group"><label for="bill-region">{{ country.regionLabel }} <span>选填</span></label><a-input id="bill-region" v-model:value="form.region" :maxlength="60" @input="editAddress" /><span v-if="errors.region" class="bill-field-error">{{ errors.region }}</span></div>
        </div>
        <div v-if="countryCode !== 'HK'" class="bill-input-group"><label for="bill-postcode">邮编</label><a-input id="bill-postcode" v-model:value="form.postalCode" :maxlength="16" :status="errors.postalCode ? 'error' : undefined" :aria-invalid="!!errors.postalCode" @input="editAddress" /><span v-if="errors.postalCode" class="bill-field-error">{{ errors.postalCode }}</span></div>
        <p v-if="loadingAddress" class="bill-small-note" role="status">正在填充地址…</p>
        <a-button type="primary" html-type="submit" size="large" block :loading="generating" :disabled="loadingAddress" class="bill-generate-button"><template #icon><FileTextOutlined /></template>{{ output ? '重新生成高清文档' : '生成高清文档' }}</a-button>
        <p class="bill-small-note">每次生成都会更新账期、用量、读数及金额。</p>
      </form>
    </section>

    <section class="bill-output-panel" aria-label="文档预览与下载">
      <div class="bill-preview-heading"><h2>文档预览</h2><span>原始高清 · 无模糊处理</span></div>
      <div class="bill-preview-toolbar">
        <div class="bill-segmented" aria-label="预览类型">
          <button type="button" :class="{ active: previewMode === 'main' }" :aria-pressed="previewMode === 'main'" @click="previewMode = 'main'">账单主图</button>
          <button type="button" :class="{ active: previewMode === 'photo' }" :aria-pressed="previewMode === 'photo'" @click="previewMode = 'photo'">实拍模拟图</button>
        </div>
        <a-button :disabled="!output" aria-label="放大预览" @click="fullscreen = true; originalSize = false"><ExpandOutlined /></a-button>
      </div>
      <div class="bill-preview-stage" :class="{ 'has-document': output, 'is-photo': previewMode === 'photo' }" :aria-busy="generating">
        <button v-if="output" type="button" class="bill-image-button" aria-label="全屏查看高清文档" @click="fullscreen = true; originalSize = false"><img :src="previewUrl" :alt="`${output.bill.template.name} ${previewMode === 'main' ? '账单主图' : '实拍模拟图'}，户名 ${output.bill.customer.name}`" /></button>
        <div v-else class="bill-empty-state"><FileTextOutlined /><h3>{{ generating ? '正在绘制高清文档' : '你的下一份演示文档' }}</h3><p>{{ generating ? '主图与实拍模拟图将一起生成' : '选择模板并填写信息，点击生成即可预览' }}</p><span>PNG 2480 × 3508 · JPG 3000 × 2500 · PDF</span></div>
      </div>
      <div class="bill-preview-caption"><span>{{ previewMode === 'main' ? '2480 × 3508 px · 无损 PNG' : '3000 × 2500 px · 高清 JPG' }}</span><span v-if="output">点击图片放大</span></div>
      <p v-if="stale" class="bill-stale" role="status">表单已修改，当前预览和下载仍为上次生成的文档。请重新生成以应用修改。</p>
      <div v-if="output" class="bill-document-details"><span>{{ output.bill.customer.name }}</span><span>{{ output.bill.country.label }} · {{ billMoney(output.bill.totalMinor, output.bill.country) }}</span></div>
      <div class="bill-downloads">
        <div class="bill-section-heading"><h2>下载高清素材</h2><span>直接下载，无需付费</span></div>
        <div class="bill-download-options">
          <label><input v-model="includeMain" type="checkbox" /><span>账单主图<small>PNG + A4 PDF</small></span></label>
          <label><input v-model="includePhoto" type="checkbox" /><span>实拍模拟图<small>高清 JPG</small></span></label>
        </div>
        <a-button type="primary" block :loading="exporting" :disabled="!output || (!includeMain && !includePhoto) || generating" @click="download('zip')"><template #icon><DownloadOutlined /></template>打包下载 ZIP</a-button>
        <div class="bill-individual-downloads"><a-button :disabled="!output || exporting || generating" @click="download('png')">下载 PNG</a-button><a-button :disabled="!output || exporting || generating" @click="download('pdf')">下载 PDF</a-button><a-button :disabled="!output || exporting || generating" @click="download('jpg')">下载 JPG</a-button></div>
      </div>
    </section>
  </div>
  <a-alert v-if="error" class="bill-message" type="error" show-icon :message="error" role="alert" />
  <p v-if="notice" class="bill-notice" role="status">{{ notice }}</p>
  <p class="bill-footnote">版式参照公开账单样张重绘，机构名称用于标明参考来源。生成内容带示例标识，非机构签发文件。输入参数保存在当前浏览器，生成的图片与文档不上传。</p>

  <a-modal v-model:open="fullscreen" title="高清文档预览" :footer="null" :width="1100" wrap-class-name="bill-preview-modal" destroy-on-close>
    <div class="bill-fullscreen-toolbar"><a-radio-group v-model:value="originalSize" button-style="solid"><a-radio-button :value="false">适应窗口</a-radio-button><a-radio-button :value="true">原始尺寸</a-radio-button></a-radio-group><a-button :loading="exporting" @click="download(previewMode === 'main' ? 'png' : 'jpg')"><DownloadOutlined />下载原图</a-button></div>
    <div class="bill-fullscreen-image" :class="{ 'original-size': originalSize }"><img v-if="output" :src="previewUrl" alt="高清账单演示文档" /></div>
  </a-modal>
</template>

<style scoped>
.bill-studio { display: grid; grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.2fr); background: var(--panel-bg); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.bill-form-panel, .bill-output-panel { min-width: 0; padding: 25px; }
.bill-form-panel { border-right: 1px solid var(--line); }
.bill-section-heading, .bill-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 22px; }
.bill-section-heading h2, .bill-preview-heading h2 { margin: 0; font-size: 16px; font-weight: 600; }
.bill-section-heading > span, .bill-preview-heading > span { color: var(--text-muted); font-size: 11px; }
.bill-field-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
.bill-countries { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.bill-countries button { display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel-bg); color: var(--text-muted); cursor: pointer; min-height: 37px; font-size: 12px; font-weight: 600; }
.bill-countries button.active { border-color: var(--primary-color); background: var(--primary-color); color: var(--primary-text); }
.bill-countries button span { font-size: 17px; }
.template-label { margin-top: 24px; display: flex; gap: 10px; align-items: center; }
.template-label span { font-weight: 400; color: var(--text-muted); }
.bill-templates { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 23px; }
.bill-template { background: transparent; border: 0; padding: 0; color: var(--text-muted); cursor: pointer; text-align: left; max-width: 48%; }
.template-paper { display: block; width: 120px; height: 170px; background: #fff; border: 1px solid #dfe3e7; border-radius: 3px; object-fit: contain; }
.bill-template.active .template-paper { outline: 2px solid var(--accent-text); outline-offset: 3px; }
.template-name { display: block; margin-top: 9px; font-size: 11px; line-height: 1.5; }
.bill-template.active .template-name { color: var(--accent-text); font-weight: 600; }
.bill-layout-source { margin: -7px 0 22px; font-size: 11px; color: var(--text-muted); line-height: 1.7; }
.bill-layout-source p { margin: 0 0 5px; }.bill-layout-source a { color: var(--accent-text); }
.bill-address-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.bill-text-button { padding: 0; border: 0; background: transparent; color: var(--accent-text); font-size: 11px; cursor: pointer; }
.bill-text-button:disabled { opacity: .5; cursor: wait; }
.bill-segmented { display: flex; padding: 3px; gap: 3px; background: var(--panel-subtle); border: 1px solid var(--line); border-radius: 7px; }
.bill-segmented button { flex: 1; border: 0; background: transparent; border-radius: 4px; padding: 6px 8px; cursor: pointer; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.bill-segmented button.active { background: var(--panel-bg); color: var(--text-main); box-shadow: 0 1px 3px #00000010; font-weight: 500; }
.bill-title-field { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; font-size: 12px; }.bill-title-field .bill-field-label { margin: 0; }
.bill-title-field label { display: flex; align-items: center; gap: 4px; }
input[type='radio'], input[type='checkbox'] { accent-color: var(--primary-color); }
.bill-input-group { margin-top: 16px; min-width: 0; }
.bill-input-group > label { display: block; margin-bottom: 7px; font-size: 12px; font-weight: 500; }
.bill-input-group > label span { color: var(--text-muted); font-size: 11px; font-weight: 400; margin-left: 4px; }
.bill-name-row { display: flex; gap: 7px; }.bill-name-row .ant-input { min-width: 0; }.bill-name-row .ant-btn { font-size: 12px; padding-inline: 10px; }
.bill-name-tools { display: flex; justify-content: flex-end; margin-top: 4px; }
.bill-field-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bill-field-error { display: block; font-size: 11px; color: var(--error-text); margin-top: 4px; }
.bill-generate-button { margin-top: 24px; }.bill-small-note { color: var(--text-muted); font-size: 11px; margin: 9px 0 0; }
.bill-output-panel { display: flex; flex-direction: column; }
.bill-preview-heading { margin-bottom: 15px; }.bill-preview-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }.bill-preview-toolbar .bill-segmented { min-width: 220px; }
.bill-preview-stage { display: flex; align-items: center; justify-content: center; min-height: 440px; flex: 1; padding: 25px; background: var(--panel-subtle); border: 1px solid var(--line); border-radius: 8px; }
.bill-preview-stage.has-document { align-items: flex-start; min-height: 0; }.bill-preview-stage.is-photo { align-items: center; padding: 12px; }
.bill-image-button { display: block; width: 100%; padding: 0; border: 0; background: transparent; cursor: zoom-in; }.bill-image-button img { display: block; width: 100%; height: auto; max-height: 690px; object-fit: contain; }
.bill-empty-state { text-align: center; color: var(--text-muted); }.bill-empty-state > .anticon { font-size: 45px; color: var(--accent-text); opacity: .75; }.bill-empty-state h3 { margin: 20px 0 8px; font-size: 16px; color: var(--text-main); font-weight: 500; }.bill-empty-state p { font-size: 12px; margin: 0; }.bill-empty-state > span { display: block; font-size: 10px; margin-top: 24px; }
.bill-preview-caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 10px; font-size: 10px; color: var(--text-muted); }
.bill-stale { margin: 12px 0 0; font-size: 12px; color: var(--error-text); }.bill-document-details { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 14px; font-size: 12px; overflow-wrap: anywhere; }
.bill-downloads { padding-top: 23px; margin-top: 22px; border-top: 1px solid var(--line); }.bill-downloads .bill-section-heading { margin-bottom: 15px; }
.bill-download-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }.bill-download-options label { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; cursor: pointer; }.bill-download-options input { margin-top: 4px; }.bill-download-options small { display: block; color: var(--text-muted); font-size: 10px; margin-top: 3px; }
.bill-individual-downloads { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }.bill-individual-downloads .ant-btn { padding-inline: 4px; font-size: 12px; }
.bill-footnote { color: var(--text-muted); font-size: 11px; line-height: 1.8; margin-top: 17px; }.bill-message { margin-top: 16px; }.bill-notice { font-size: 12px; color: var(--accent-text); }
.bill-fullscreen-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 14px 0; }.bill-fullscreen-image { height: 72vh; overflow: auto; padding: 16px; background: var(--panel-subtle); text-align: center; }.bill-fullscreen-image img { display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; margin: auto; }.bill-fullscreen-image.original-size img { max-width: none; max-height: none; margin: 0; }
@media (max-width: 1100px) and (min-width: 901px) { .bill-form-panel, .bill-output-panel { padding: 18px; }.bill-studio { grid-template-columns: minmax(310px, 1fr) minmax(0, 1.1fr); }.bill-preview-stage { padding: 15px; }.bill-preview-heading > span { font-size: 10px; } }
@media (max-width: 900px) { .bill-studio { grid-template-columns: 1fr; }.bill-form-panel { border-right: 0; border-bottom: 1px solid var(--line); }.bill-preview-stage { min-height: 350px; }.bill-preview-stage.has-document { min-height: 0; }.bill-image-button img { max-height: 760px; } }
@media (max-width: 480px) { .bill-form-panel, .bill-output-panel { padding: 18px; }.bill-section-heading, .bill-preview-heading { gap: 6px; }.bill-section-heading > span, .bill-preview-heading > span { font-size: 10px; }.bill-preview-stage { padding: 12px; }.bill-countries { gap: 6px; }.bill-field-pair { grid-template-columns: 1fr; gap: 0; }.bill-fullscreen-toolbar { flex-wrap: wrap; }.bill-fullscreen-image { padding: 4px; }.bill-preview-toolbar .bill-segmented { min-width: 0; flex: 1; } }
</style>
