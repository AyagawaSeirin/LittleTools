import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { blankResult, type RegexDocument, type RegexResult } from '../utils/regex'

export function useRegexWorker() {
  const result = shallowRef<RegexResult>(blankResult()), busy = ref(false)
  let worker: Worker | undefined, timer: ReturnType<typeof setTimeout> | undefined, debounce: ReturnType<typeof setTimeout> | undefined, revision = 0
  function destroy() { clearTimeout(timer); worker?.terminate(); worker = undefined }
  function fail(message: string) { destroy(); busy.value = false; result.value = { ...blankResult(), error: message } }
  function run(document: RegexDocument, immediate = false) {
    clearTimeout(debounce)
    if (busy.value) destroy()
    const id = ++revision
    busy.value = true
    // Clear stale matches as soon as inputs change, before the debounce interval.
    result.value = blankResult()
    const snapshot = JSON.parse(JSON.stringify(document)) as RegexDocument
    debounce = setTimeout(() => {
      try {
        worker ??= new Worker(new URL('../workers/regex.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (event: MessageEvent<{ id: number; result: RegexResult }>) => {
          if (event.data.id !== revision) return
          clearTimeout(timer)
          result.value = event.data.result
          busy.value = false
        }
        worker.onerror = () => { if (id === revision) fail('正则引擎加载或运行失败，请点击“重新运行”。') }
        timer = setTimeout(() => { if (id === revision) fail('执行超过 3 秒，已停止。请减少嵌套量词、缩小文本后重试。') }, 3000)
        worker.postMessage({ id, document: snapshot })
      } catch { fail('当前环境无法启动正则 Worker，请检查浏览器是否允许脚本与 WebAssembly。') }
    }, immediate ? 0 : 180)
  }
  function stop() { revision++; clearTimeout(debounce); fail('已停止执行。修改表达式或点击“重新运行”继续。') }
  onBeforeUnmount(() => { revision++; clearTimeout(debounce); destroy() })
  return { result, busy, run, stop }
}
