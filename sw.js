'use strict';

const CACHE_NAME = 'evolupersonal-md500-offline-v3';
// Increment SHELL_CACHE on every release, even when only index.html changes.
// Keep CACHE_NAME stable to preserve downloaded exercise media.
const SHELL_CACHE = 'evolupersonal-shell-beta-1.7-rc-etapa4';
// Beta 1.2 — recuperação de downloads e navegação offline; mantém v3 para preservar a mídia já baixada offline.
const SCOPE_URL = self.registration.scope;
const SHELL = ['./index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './training-methods.js', './insights.js', './programs.js', './execution.js', './history-tools.js', './routine-tools.js', './import-analysis.js', './offline-assets.json', './OFFLINE_CREDITS.md'];
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

async function fetchExternalMedia(url) {
  try {
    const response = await fetch(new Request(url, { mode: 'cors', cache: 'reload' }));
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const type = response.headers.get('Content-Type') || '';
    if (!type.toLowerCase().startsWith('image/')) throw new Error('A fonte não retornou uma imagem.');
    return response;
  } catch (error) {
    // HTTP and content errors are definitive. Only CORS/network failures may use opaque responses.
    if (!(error instanceof TypeError)) throw error;
    const response = await fetch(new Request(url, { mode: 'no-cors', cache: 'reload' }));
    if (!response.ok && response.type !== 'opaque') throw new Error('HTTP ' + response.status);
    return response;
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
    const response = await fetchExternalMedia(url);
    if (response.ok || response.type === 'opaque') {
      await cache.put(key, response.clone());
      return response;
    }
  } catch (_) {}
  return new Response('Mídia externa ainda não está disponível offline.', { status: 503 });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL.map(path => new Request(new URL(path, SCOPE_URL), { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('evolupersonal-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key)));
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
    const isNavigation = request.mode === 'navigate';
    const shellRequest = isNavigation || SHELL.some(path => new URL(path, SCOPE_URL).pathname === requestURL.pathname);
    const cache = await caches.open(shellRequest ? SHELL_CACHE : CACHE_NAME);
    if (shellRequest) {
      const installed = await cache.match(request, { ignoreSearch: true })
        || (isNavigation ? await cache.match(new URL('./index.html', SCOPE_URL).href) : null);
      if (installed) return installed;
    }
    if (!isNavigation) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (isNavigation && response.status >= 500) {
        const fallback = await cache.match(request, { ignoreSearch: true })
          || await cache.match(new URL('./index.html', SCOPE_URL).href);
        if (fallback) return fallback;
      }
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
      const manifestURL = new URL('./offline-assets.json', SCOPE_URL);
      const response = await fetch(manifestURL).catch(async () => await (await caches.open(SHELL_CACHE)).match(manifestURL) || await cache.match(manifestURL));
      if (!response?.ok) throw new Error('Não foi possível obter a lista de mídias. Conecte-se para baixar o pacote pela primeira vez.');
      manifest = await response.json();
    } catch (error) {
      port.postMessage({ type: 'ERROR', message: error.message || 'Falha ao ler a lista de mídias.' });
      return;
    }

    if (!Array.isArray(manifest.assets) || manifest.assets.some(path => typeof path !== 'string')) {
      port.postMessage({ type: 'ERROR', message: 'A lista de mídias está inválida. Verifique as atualizações.' });
      return;
    }
    const assets = [...new Set(manifest.assets)];
    const localAssets = assets.filter(path => !/^https:\/\//i.test(path));
    const declaredExternal = assets.filter(path => /^https:\/\//i.test(path)).map(safeExternalURL).filter(Boolean);
    const externalURLs = [...new Set([...declaredExternal, ...(event.data.urls || []).map(safeExternalURL).filter(Boolean)])];
    const total = localAssets.length + externalURLs.length;
    let complete = 0;
    const failed = [];
    let unverified = 0;
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
          const cached = await cache.match(key);
          if (!cached || cached.type === 'opaque') {
            try {
              const response = await fetchExternalMedia(value);
              if (response.type === 'opaque') unverified++;
              await cache.put(key, response);
            } catch (error) {
              // Preserve existing offline media when a refresh fails.
              if (cached) unverified++;
              throw error;
            }
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
      unverified,
      failed: failed.slice(0, 30),
      bytes: manifest.bytes || 0
    });
  })());
});


