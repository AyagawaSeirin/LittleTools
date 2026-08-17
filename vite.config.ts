import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

function shortHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function offlineServiceWorker(): Plugin {
  return {
    name: 'little-tools-offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((file) => !file.endsWith('.map')).sort()
      const precache = Array.from(new Set(['./', './index.html', ...files.map((file) => `./${file}`)]))
      const version = shortHash(files.join('|'))
      const source = `
const CACHE_PREFIX = 'little-tools-';
const CACHE_NAME = CACHE_PREFIX + '${version}';
const PRECACHE = ${JSON.stringify(precache)};

async function openCurrentCache() {
  return caches.open(CACHE_NAME);
}

async function refreshPrecache() {
  let resources = PRECACHE;
  let latestVersion = '${version}';
  try {
    const manifestResponse = await fetch('./offline-manifest.json?update=' + Date.now(), { cache: 'no-store' });
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      if (Array.isArray(manifest.resources) && manifest.resources.every((url) => typeof url === 'string' && url.startsWith('./'))) {
        resources = manifest.resources;
        latestVersion = String(manifest.version || latestVersion);
      }
    }
  } catch {}
  const cache = await openCurrentCache();
  const results = await Promise.allSettled(resources.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error('Failed to refresh ' + url);
    await cache.put(url, response);
  }));
  const failed = results.filter((result) => result.status === 'rejected').length;
  return { ok: failed === 0, failed, total: results.length, version: latestVersion };
}

self.addEventListener('install', (event) => {
  event.waitUntil(openCurrentCache().then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === 'REFRESH_CACHE') {
    event.waitUntil(refreshPrecache()
      .then((result) => event.ports[0]?.postMessage(result))
      .catch((error) => event.ports[0]?.postMessage({ ok: false, error: String(error), version: '${version}' })));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await openCurrentCache();
      return (await cache.match('./index.html', { ignoreVary: true })) || (await cache.match('./', { ignoreVary: true })) || fetch(request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await openCurrentCache();
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
`.trimStart()

      this.emitFile({
        type: 'asset',
        fileName: 'offline-manifest.json',
        source: JSON.stringify({ version, resources: precache }, null, 2),
      })
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), offlineServiceWorker()],
})
