import { computed, ref } from 'vue'

type CacheState = 'idle' | 'ready' | 'updating' | 'updated' | 'error'

const isOffline = ref(!navigator.onLine)
const cacheState = ref<CacheState>('idle')
const updateAvailable = ref(false)
const isAvailable = ref(import.meta.env.PROD && 'serviceWorker' in navigator)
let registrationPromise: Promise<ServiceWorkerRegistration> | null = null
let initialized = false

function waitForInstallation(worker: ServiceWorker) {
  if (['installed', 'activated', 'redundant'].includes(worker.state)) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 15000)
    worker.addEventListener('statechange', () => {
      if (['installed', 'activated', 'redundant'].includes(worker.state)) {
        window.clearTimeout(timeout)
        resolve()
      }
    })
  })
}

function postRefresh(worker: ServiceWorker) {
  return new Promise<{ ok: boolean }>((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => reject(new Error('更新缓存超时')), 25000)
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout)
      resolve(event.data as { ok: boolean })
    }
    worker.postMessage({ type: 'REFRESH_CACHE' }, [channel.port2])
  })
}

function registerServiceWorker() {
  if (!isAvailable.value) return null
  if (registrationPromise) return registrationPromise

  const workerUrl = new URL('./sw.js', window.location.href)
  workerUrl.hash = ''
  registrationPromise = navigator.serviceWorker.register(workerUrl.href, { updateViaCache: 'none' })
    .then(async (registration) => {
      cacheState.value = 'ready'
      updateAvailable.value = Boolean(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) updateAvailable.value = true
        })
      })
      await navigator.serviceWorker.ready
      const reloadKey = 'little-tools-sw-first-control'
      if (!navigator.serviceWorker.controller && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1')
        window.setTimeout(() => window.location.reload(), 100)
      } else if (navigator.serviceWorker.controller) {
        sessionStorage.removeItem(reloadKey)
      }
      return registration
    })
    .catch((error) => {
      registrationPromise = null
      cacheState.value = 'error'
      throw error
    })
  return registrationPromise
}

function initialize() {
  if (initialized) return
  initialized = true
  window.addEventListener('online', () => { isOffline.value = false })
  window.addEventListener('offline', () => { isOffline.value = true })
  if (document.readyState === 'complete') registerServiceWorker()
  else window.addEventListener('load', registerServiceWorker, { once: true })
}

async function refreshCache() {
  if (!isAvailable.value || isOffline.value || cacheState.value === 'updating') return
  cacheState.value = 'updating'
  try {
    const registration = await registerServiceWorker()
    if (!registration) throw new Error('浏览器不支持离线缓存')
    await registration.update()
    if (registration.installing) await waitForInstallation(registration.installing)

    if (registration.waiting) {
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }

    const worker = registration.active || navigator.serviceWorker.controller
    if (!worker) throw new Error('离线缓存尚未就绪')
    const result = await postRefresh(worker)
    if (!result.ok) throw new Error('部分资源更新失败')
    updateAvailable.value = false
    cacheState.value = 'updated'
    window.setTimeout(() => window.location.reload(), 800)
  } catch {
    cacheState.value = 'error'
    window.setTimeout(() => { if (cacheState.value === 'error') cacheState.value = 'ready' }, 4000)
  }
}

export function useServiceWorker() {
  initialize()
  return {
    isAvailable: computed(() => isAvailable.value),
    isOffline: computed(() => isOffline.value),
    isUpdating: computed(() => cacheState.value === 'updating'),
    updateAvailable: computed(() => updateAvailable.value),
    cacheButtonText: computed(() => {
      if (cacheState.value === 'updated') return '已更新'
      if (cacheState.value === 'error') return '更新失败'
      if (cacheState.value === 'updating') return '更新中'
      return '更新缓存'
    }),
    cacheButtonTitle: computed(() => {
      if (isOffline.value) return '当前处于离线模式，已缓存的工具仍可使用'
      if (updateAvailable.value) return '发现网站新版本，点击更新本地缓存'
      return '检查网站更新并重新缓存全部工具资源'
    }),
    refreshCache,
  }
}
