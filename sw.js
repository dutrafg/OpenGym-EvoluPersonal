'use strict';

const CACHE_NAME = 'evolupersonal-md500-offline-v3';
const SCOPE_URL = self.registration.scope;
const SHELL = ['./index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './training-methods.js', './insights.js', './programs.js', './offline-assets.json', './OFFLINE_CREDITS.md'];
const ALLOWED_MEDIA_HOSTS = new Set(['gellyfish-ai.github.io', 'raw.githubusercontent.com']);
const MEDIA_PROXY_PATH = new URL('./__offline-media', SCOPE_URL).pathname;

function safeExternalURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_MEDIA_HOSTS.has(url.hostname) ? url.href : null;
  } catch (_) {
    return null;
  }
}

async function cachedExternalResponse(value) {
  const url = safeExternalURL(value);
  if (!url) return new Response('Fonte externa não permitida.', { status: 400 });
  const cache = await caches.open(CACHE_NAME);
  const key = new Request(url, { mode: 'no-cors' });
  const cached = await cache.match(key, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(key);
    if (response.ok || response.type === 'opaque') {
      await cache.put(key, response.clone());
      return response;
    }
  } catch (_) {}
  return new Response('Mídia externa ainda não está disponível offline.', { status: 503 });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL.map(path => new Request(new URL(path, SCOPE_URL))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('evolupersonal-md500-offline-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const requestURL = new URL(request.url);
  if (request.method !== 'GET') return;

  if (requestURL.origin === self.location.origin && requestURL.pathname === MEDIA_PROXY_PATH) {
    event.respondWith(cachedExternalResponse(requestURL.searchParams.get('src') || ''));
    return;
  }
  if (requestURL.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isNavigation = request.mode === 'navigate';
    if (!isNavigation) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && (isNavigation || request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || requestURL.pathname.endsWith('/offline-assets.json') || requestURL.pathname.endsWith('/OFFLINE_CREDITS.md'))) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      const fallback = await cache.match(request, { ignoreSearch: true })
        || (isNavigation ? await cache.match(new URL('./index.html', SCOPE_URL).href) : null);
      if (fallback) return fallback;
      return new Response('Este arquivo ainda não foi baixado para uso offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type !== 'CACHE_LIBRARY' || !event.ports?.[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let manifest;
    try {
      const response = await fetch(new URL('./offline-assets.json', SCOPE_URL));
      if (!response.ok) throw new Error('Não foi possível obter a lista de mídias.');
      manifest = await response.json();
    } catch (error) {
      port.postMessage({ type: 'ERROR', message: error.message || 'Falha ao ler a lista de mídias.' });
      return;
    }

    const assets = manifest.assets || [];
    const localAssets = assets.filter(path => !/^https:\/\//i.test(path));
    const declaredExternal = assets.filter(path => /^https:\/\//i.test(path)).map(safeExternalURL).filter(Boolean);
    const externalURLs = [...new Set([...declaredExternal, ...(event.data.urls || []).map(safeExternalURL).filter(Boolean)])];
    const total = localAssets.length + externalURLs.length;
    let complete = 0;
    const failed = [];
    port.postMessage({ type: 'PROGRESS', total, complete, failed: 0, bytes: manifest.bytes || 0 });

    for (let offset = 0; offset < localAssets.length; offset += 3) {
      const batch = localAssets.slice(offset, offset + 3);
      await Promise.all(batch.map(async path => {
        const url = new URL(path, SCOPE_URL).href;
        try {
          if (!await cache.match(url)) {
            const response = await fetch(url, { cache: 'reload' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            await cache.put(url, response);
          }
        } catch (error) {
          failed.push({ path, reason: error.message || 'falha de rede' });
        } finally {
          complete++;
          port.postMessage({ type: 'PROGRESS', total, complete, failed: failed.length, bytes: manifest.bytes || 0 });
        }
      }));
    }

    for (let offset = 0; offset < externalURLs.length; offset += 4) {
      const batch = externalURLs.slice(offset, offset + 4);
      await Promise.all(batch.map(async value => {
        const key = new Request(value, { mode: 'no-cors' });
        try {
          if (!await cache.match(key)) {
            const response = await fetch(key);
            if (!response.ok && response.type !== 'opaque') throw new Error('HTTP ' + response.status);
            await cache.put(key, response);
          }
        } catch (error) {
          failed.push({ path: value, reason: error.message || 'falha ao baixar fonte externa' });
        } finally {
          complete++;
          port.postMessage({ type: 'PROGRESS', total, complete, failed: failed.length, bytes: manifest.bytes || 0 });
        }
      }));
    }

    port.postMessage({
      type: 'DONE',
      total,
      localTotal: localAssets.length,
      externalTotal: externalURLs.length,
      complete,
      failedCount: failed.length,
      failed: failed.slice(0, 30),
      bytes: manifest.bytes || 0
    });
  })());
});

