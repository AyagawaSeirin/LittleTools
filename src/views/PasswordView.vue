<script setup lang="ts">
import { computed, ref } from 'vue'
import { DeleteOutlined, KeyOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import ToolPageHeader from '../components/ToolPageHeader.vue'
import ToolCard from '../components/ToolCard.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { rememberToolSettings } from '../composables/useToolSettings'
import { estimateEntropy, generatePassword, passwordCharsets, strengthFromEntropy, type CharsetKey } from '../utils/password'

const length = ref(18)
const count = ref(1)
const enabled = ref<CharsetKey[]>(['lowercase', 'uppercase', 'numbers', 'symbols'])
const excluded = ref('il1LoO0')
const results = ref<string[]>([])
const history = ref<string[]>(JSON.parse(sessionStorage.getItem('password-history') || '[]'))
const error = ref('')

rememberToolSettings('password', { length, count, enabled, excluded })

const poolSize = computed(() => {
  const blocked = new Set(Array.from(excluded.value))
  return enabled.value.reduce((sum, key) => sum + Array.from(passwordCharsets[key]).filter((char) => !blocked.has(char)).length, 0)
})
const entropy = computed(() => estimateEntropy(length.value, poolSize.value))
const strength = computed(() => strengthFromEntropy(entropy.value))

function generate() {
  error.value = ''
  try {
    results.value = Array.from({ length: count.value }, () => generatePassword(length.value, enabled.value, excluded.value))
    history.value = [...results.value, ...history.value].slice(0, 12)
    sessionStorage.setItem('password-history', JSON.stringify(history.value))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '生成失败'
  }
}

function clearHistory() {
  history.value = []
  sessionStorage.removeItem('password-history')
}

generate()
</script>

<template>
  <ToolPageHeader title="随机密码生成" description="使用 Web Crypto 安全随机源，密码只在当前浏览器内生成" :icon="KeyOutlined" color="#9b5c31" />
  <ToolCard title="生成设置" description="至少选择一种字符类型；生成结果不会上传或保存到服务器。">
    <div class="form-grid">
      <div class="form-field full">
        <span class="field-label">使用字符</span>
        <a-checkbox-group v-model:value="enabled" class="option-row">
          <a-checkbox value="lowercase">小写字母 a–z</a-checkbox>
          <a-checkbox value="uppercase">大写字母 A–Z</a-checkbox>
          <a-checkbox value="numbers">数字 0–9</a-checkbox>
          <a-checkbox value="symbols">特殊符号</a-checkbox>
        </a-checkbox-group>
      </div>
      <div class="form-field full">
        <span class="field-label">排除字符 <span class="field-hint">常用于排除易混淆字符</span></span>
        <a-input v-model:value="excluded" placeholder="例如：il1LoO0" allow-clear />
      </div>
      <div class="form-field">
        <span class="field-label">密码长度 <span class="field-hint">{{ length }} 位</span></span>
        <a-slider v-model:value="length" :min="4" :max="64" />
      </div>
      <div class="form-field">
        <span class="field-label">生成数量</span>
        <a-input-number v-model:value="count" :min="1" :max="20" style="width: 100%" />
      </div>
    </div>
    <a-alert v-if="error" class="inline-alert" type="error" show-icon :message="error" />
    <div class="form-actions">
      <a-button type="primary" size="large" :disabled="!enabled.length" @click="generate">
        <template #icon><ReloadOutlined /></template>生成密码
      </a-button>
    </div>
    <ResultPanel :value="results.join('\n')" empty-text="设置条件后生成密码" :label="results.length > 1 ? `生成结果 · ${results.length} 个` : '生成结果'" />
    <div class="strength-row">
      <div><span>强度：<b :style="{ color: strength.color }">{{ strength.label }}</b></span><small>估算熵 {{ entropy }} bits</small></div>
      <a-progress :percent="strength.percent" :show-info="false" :stroke-color="strength.color" />
    </div>
  </ToolCard>

  <ToolCard v-if="history.length" title="本次访问记录" description="仅保存在当前标签页会话中，关闭后自动清除。">
    <div class="history-list">
      <code v-for="(item, index) in history" :key="`${item}-${index}`">{{ item }}</code>
    </div>
    <a-button size="small" @click="clearHistory"><DeleteOutlined /> 清空记录</a-button>
  </ToolCard>
</template>

<style scoped>
.inline-alert { margin-top: 18px; }
.strength-row { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 20px; margin-top: 16px; }
.strength-row div:first-child { display: flex; flex-direction: column; font-size: 13px; }
.strength-row small { margin-top: 3px; color: var(--text-muted); }
.history-list { display: flex; flex-direction: column; gap: 1px; overflow: hidden; margin-bottom: 15px; border: 1px solid var(--line); border-radius: 8px; background: var(--line); }
.history-list code { padding: 10px 13px; overflow-wrap: anywhere; background: var(--panel-subtle); color: var(--text-main); }
@media (max-width: 640px) { .strength-row { grid-template-columns: 1fr; gap: 6px; } }
</style>
