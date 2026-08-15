<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { ClockCircleOutlined, CopyOutlined, SyncOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import { rememberToolSettings } from '../composables/useToolSettings'

const now = ref(Date.now())
const timer = window.setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => window.clearInterval(timer))

const timestampInput = ref(String(Math.floor(Date.now() / 1000)))
const inputUnit = ref<'auto' | 's' | 'ms'>('auto')
const timestampError = ref('')
const convertedMillis = ref(Date.now())
const selectedDate = ref<Dayjs>(dayjs())
const outputUnit = ref<'s' | 'ms'>('s')
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone

rememberToolSettings(
  'timestamp',
  { timestampInput, inputUnit, selectedDate, outputUnit },
  {
    selectedDate: { serialize: (value: Dayjs) => value.toISOString(), deserialize: (value) => dayjs(String(value)) },
  },
)

const timestampResult = computed(() => ({
  local: formatDate(convertedMillis.value, localZone),
  utc: formatDate(convertedMillis.value, 'UTC'),
  iso: new Date(convertedMillis.value).toISOString(),
}))
const dateTimestamp = computed(() => outputUnit.value === 's' ? Math.floor(selectedDate.value.valueOf() / 1000) : selectedDate.value.valueOf())

function formatDate(value: number, timeZone: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(value)).replaceAll('/', '-')
}

function convertTimestamp() {
  timestampError.value = ''
  const value = Number(timestampInput.value.trim())
  if (!Number.isFinite(value)) { timestampError.value = '请输入有效的数字时间戳'; return }
  const unit = inputUnit.value === 'auto' ? (Math.abs(value) < 100_000_000_000 ? 's' : 'ms') : inputUnit.value
  const millis = unit === 's' ? value * 1000 : value
  if (Number.isNaN(new Date(millis).getTime())) { timestampError.value = '时间戳超出可转换范围'; return }
  convertedMillis.value = millis
}

function useNow() {
  timestampInput.value = String(inputUnit.value === 'ms' ? Date.now() : Math.floor(Date.now() / 1000))
  convertTimestamp()
}

async function copy(value: string | number) { await navigator.clipboard.writeText(String(value)) }

convertTimestamp()
</script>

<template>
  <ToolPageHeader title="时间戳转换" description="Unix 时间戳与日期时间双向转换，支持秒和毫秒" :icon="ClockCircleOutlined" color="#a24f59">
    <template #extra><div class="now-chip"><span>当前秒级时间戳</span><b>{{ Math.floor(now / 1000) }}</b></div></template>
  </ToolPageHeader>

  <ToolCard title="时间戳转日期" description="自动模式会根据位数判断秒级或毫秒级。">
    <div class="timestamp-input">
      <a-input v-model:value="timestampInput" class="mono" placeholder="例如 1755331200" @press-enter="convertTimestamp" />
      <a-select v-model:value="inputUnit" style="width: 130px"><a-select-option value="auto">自动判断</a-select-option><a-select-option value="s">秒</a-select-option><a-select-option value="ms">毫秒</a-select-option></a-select>
      <a-button type="primary" @click="convertTimestamp">转换</a-button>
      <a-button @click="useNow"><SyncOutlined /> 当前时间</a-button>
    </div>
    <a-alert v-if="timestampError" type="error" show-icon :message="timestampError" style="margin-top: 16px" />
    <div v-else class="time-results">
      <div><span>本地时间 · {{ localZone }}</span><code>{{ timestampResult.local }}</code><a-button type="text" size="small" @click="copy(timestampResult.local)"><CopyOutlined /></a-button></div>
      <div><span>UTC 时间</span><code>{{ timestampResult.utc }}</code><a-button type="text" size="small" @click="copy(timestampResult.utc)"><CopyOutlined /></a-button></div>
      <div><span>ISO 8601</span><code>{{ timestampResult.iso }}</code><a-button type="text" size="small" @click="copy(timestampResult.iso)"><CopyOutlined /></a-button></div>
    </div>
  </ToolCard>

  <ToolCard title="日期转时间戳">
    <div class="date-to-timestamp">
      <div class="form-field"><span class="field-label">本地日期与时间</span><a-date-picker v-model:value="selectedDate" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></div>
      <div class="form-field"><span class="field-label">输出单位</span><a-segmented v-model:value="outputUnit" :options="[{ label: '秒', value: 's' }, { label: '毫秒', value: 'ms' }]" block /></div>
      <div class="timestamp-output"><span>{{ outputUnit === 's' ? '秒级时间戳' : '毫秒级时间戳' }}</span><code>{{ dateTimestamp }}</code><a-button type="text" @click="copy(dateTimestamp)"><CopyOutlined /></a-button></div>
    </div>
  </ToolCard>
</template>

<style scoped>
.now-chip { display: flex; flex-direction: column; align-items: flex-end; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-bg); }
.now-chip span { color: var(--text-muted); font-size: 10px; }
.now-chip b { margin-top: 2px; font-family: monospace; font-size: 14px; }
.timestamp-input { display: grid; grid-template-columns: minmax(180px, 1fr) 130px auto auto; gap: 10px; }
.time-results { margin-top: 20px; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; }
.time-results > div { display: grid; grid-template-columns: 190px minmax(0, 1fr) auto; align-items: center; min-height: 52px; padding: 0 8px 0 15px; border-bottom: 1px solid var(--line); }
.time-results > div:last-child { border-bottom: 0; }
.time-results span { color: var(--text-muted); font-size: 12px; }
.time-results code { overflow-wrap: anywhere; color: var(--text-main); }
.date-to-timestamp { display: grid; grid-template-columns: 1fr 220px; gap: 18px; }
.timestamp-output { grid-column: 1 / -1; display: grid; grid-template-columns: 160px 1fr auto; align-items: center; padding: 12px 8px 12px 15px; border-radius: 8px; background: var(--panel-subtle); }
.timestamp-output span { color: var(--text-muted); font-size: 12px; }
.timestamp-output code { color: var(--primary-color); font-size: 18px; font-weight: 600; }
@media (max-width: 720px) { .timestamp-input { grid-template-columns: 1fr 120px; } .timestamp-input .ant-btn { width: 100%; } .time-results > div { grid-template-columns: 1fr auto; padding-top: 10px; padding-bottom: 10px; } .time-results code { grid-column: 1; margin-top: 5px; } .time-results .ant-btn { grid-column: 2; grid-row: 1 / 3; } .date-to-timestamp { grid-template-columns: 1fr; } .timestamp-output { grid-column: auto; grid-template-columns: 1fr auto; } .timestamp-output code { grid-column: 1; margin-top: 5px; } .timestamp-output .ant-btn { grid-column: 2; grid-row: 1 / 3; } }
</style>
