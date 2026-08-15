<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { CalendarOutlined, SwapOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import { rememberToolSettings } from '../composables/useToolSettings'

const startDate = ref<Dayjs>(dayjs())
const endDate = ref<Dayjs>(dayjs().add(15, 'day'))
const baseDate = ref<Dayjs>(dayjs())
const direction = ref<'add' | 'subtract'>('add')
const amount = ref(30)
const unit = ref<'day' | 'week' | 'month' | 'year'>('day')
const workdaysOnly = ref(false)

rememberToolSettings(
  'date-calculator',
  { startDate, endDate, baseDate, direction, amount, unit, workdaysOnly },
  {
    startDate: { serialize: (value: Dayjs) => value.toISOString(), deserialize: (value) => dayjs(String(value)) },
    endDate: { serialize: (value: Dayjs) => value.toISOString(), deserialize: (value) => dayjs(String(value)) },
    baseDate: { serialize: (value: Dayjs) => value.toISOString(), deserialize: (value) => dayjs(String(value)) },
  },
)

const signedDays = computed(() => endDate.value.startOf('day').diff(startDate.value.startOf('day'), 'day'))
const calendarDays = computed(() => Math.abs(signedDays.value))
const durationText = computed(() => {
  const start = startDate.value.startOf('day')
  const end = endDate.value.startOf('day')
  const earlier = start.isBefore(end) ? start : end
  const later = start.isBefore(end) ? end : start
  const years = later.diff(earlier, 'year')
  const afterYears = earlier.add(years, 'year')
  const months = later.diff(afterYears, 'month')
  const days = later.diff(afterYears.add(months, 'month'), 'day')
  return `${years} 年 ${months} 个月 ${days} 天`
})
const workdayCount = computed(() => {
  let cursor = startDate.value.startOf('day')
  const target = endDate.value.startOf('day')
  const step = cursor.isAfter(target) ? -1 : 1
  let count = 0
  while (!cursor.isSame(target, 'day')) {
    cursor = cursor.add(step, 'day')
    if (cursor.day() !== 0 && cursor.day() !== 6) count += step
  }
  return Math.abs(count)
})
const calculatedDate = computed(() => {
  const multiplier = direction.value === 'add' ? 1 : -1
  if (workdaysOnly.value && unit.value === 'day') {
    let cursor = baseDate.value
    let remaining = amount.value
    while (remaining > 0) {
      cursor = cursor.add(multiplier, 'day')
      if (cursor.day() !== 0 && cursor.day() !== 6) remaining -= 1
    }
    return cursor
  }
  return baseDate.value.add(multiplier * amount.value, unit.value)
})

function swapDates() {
  ;[startDate.value, endDate.value] = [endDate.value, startDate.value]
}
</script>

<template>
  <ToolPageHeader title="日期计算器" description="计算日期间隔，或从指定日期向前、向后推算" :icon="CalendarOutlined" color="#316b9b" />
  <ToolCard title="两个日期相差多久" description="自然日按两个日期零点计算，起始当天不重复计入。">
    <div class="date-pair">
      <div class="form-field"><span class="field-label">开始日期</span><a-date-picker v-model:value="startDate" format="YYYY年 M月 D日" /></div>
      <a-button class="swap-button" shape="circle" aria-label="交换日期" @click="swapDates"><SwapOutlined /></a-button>
      <div class="form-field"><span class="field-label">结束日期</span><a-date-picker v-model:value="endDate" format="YYYY年 M月 D日" /></div>
    </div>
    <div class="date-result">
      <div><span>相差自然日</span><strong>{{ calendarDays }}</strong><small>天</small></div>
      <div><span>完整时段</span><b>{{ durationText }}</b></div>
      <div><span>其中工作日</span><b>{{ workdayCount }} 天</b></div>
    </div>
  </ToolCard>

  <ToolCard title="推算几天后的日期" description="工作日计算仅排除周六与周日，不包含法定节假日。">
    <div class="form-grid three">
      <div class="form-field"><span class="field-label">基准日期</span><a-date-picker v-model:value="baseDate" format="YYYY年 M月 D日" style="width: 100%" /></div>
      <div class="form-field"><span class="field-label">方向与数量</span><a-input-group compact><a-select v-model:value="direction" style="width: 38%"><a-select-option value="add">往后</a-select-option><a-select-option value="subtract">往前</a-select-option></a-select><a-input-number v-model:value="amount" :min="0" :max="100000" style="width: 62%" /></a-input-group></div>
      <div class="form-field"><span class="field-label">单位</span><a-select v-model:value="unit" style="width: 100%"><a-select-option value="day">天</a-select-option><a-select-option value="week">周</a-select-option><a-select-option value="month">个月</a-select-option><a-select-option value="year">年</a-select-option></a-select></div>
      <div class="form-field full"><a-checkbox v-model:checked="workdaysOnly" :disabled="unit !== 'day'">只计算工作日（周一至周五）</a-checkbox></div>
    </div>
    <div class="calculated-date">
      <span>计算结果</span>
      <strong>{{ calculatedDate.format('YYYY年 M月 D日') }}</strong>
      <small>{{ calculatedDate.format('dddd') === 'Sunday' ? '星期日' : ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][calculatedDate.day()] }}</small>
    </div>
  </ToolCard>
</template>

<style scoped>
.date-pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 16px; }
.date-pair :deep(.ant-picker) { width: 100%; }
.swap-button { margin-bottom: 1px; }
.date-result { display: grid; grid-template-columns: 1.2fr 1fr 1fr; margin-top: 22px; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: var(--line); gap: 1px; }
.date-result > div { min-height: 105px; padding: 17px; background: var(--panel-subtle); }
.date-result span { display: block; color: var(--text-muted); font-size: 12px; }
.date-result strong { display: inline-block; margin-top: 7px; color: var(--primary-color); font-size: 36px; line-height: 1; }
.date-result small { margin-left: 6px; color: var(--text-muted); }
.date-result b { display: block; margin-top: 15px; color: var(--text-main); font-size: 16px; }
.calculated-date { display: flex; align-items: baseline; gap: 12px; margin-top: 22px; padding: 20px; border-radius: 10px; background: color-mix(in srgb, var(--primary-color) 8%, var(--panel-subtle)); }
.calculated-date span, .calculated-date small { color: var(--text-muted); font-size: 12px; }
.calculated-date strong { color: var(--primary-color); font-size: 24px; }
@media (max-width: 640px) { .date-pair { grid-template-columns: 1fr; } .swap-button { justify-self: center; transform: rotate(90deg); } .date-result { grid-template-columns: 1fr; } .calculated-date { flex-wrap: wrap; } .calculated-date strong { flex-basis: 100%; } }
</style>
