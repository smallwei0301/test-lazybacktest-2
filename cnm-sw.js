// Patch Tag: LB-CNM-SW-HOTFIX-20251030A
// 目的：覆寫舊版 cnm-sw 服務工作者，避免於 204/205/304 等無內文狀態建立附帶內文的 Response。

const CNM_SW_VERSION = 'LB-CNM-SW-HOTFIX-20251030A';
const CNM_SW_CACHE_NAME = 'lb-cnm-sw-cache-v20251030a';
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);
const CACHE_NAME_PREFIX = 'lb-cnm-sw-cache-';

self.addEventListener('install', () => {
  self.skipWaiting();
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info(`[CNM-SW] 安裝版本 ${CNM_SW_VERSION}`);
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const obsolete = keys.filter((key) => key.startsWith(CACHE_NAME_PREFIX) && key !== CNM_SW_CACHE_NAME);
      await Promise.all(obsolete.map((key) => caches.delete(key)));
      await self.clients.claim();
      if (typeof console !== 'undefined' && typeof console.info === 'function') {
        console.info(`[CNM-SW] 啟用完成，已清除 ${obsolete.length} 個舊快取`);
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request || request.method !== 'GET') return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  let networkResponse;
  try {
    networkResponse = await fetch(request);
  } catch (networkError) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw networkError;
  }

  if (!networkResponse) return networkResponse;

  if (NULL_BODY_STATUSES.has(networkResponse.status)) {
    return buildNullBodyClone(networkResponse);
  }

  if (shouldCache(request, networkResponse)) {
    try {
      const cache = await caches.open(CNM_SW_CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    } catch (cacheError) {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[CNM-SW] 快取失敗:', cacheError);
      }
    }
  }

  return networkResponse;
}

function shouldCache(request, response) {
  if (!response) return false;
  if (request.method !== 'GET') return false;
  if (response.status >= 500) return false;
  if (!['basic', 'cors', 'default'].includes(response.type)) return false;
  const cacheControl = response.headers && typeof response.headers.get === 'function'
    ? response.headers.get('Cache-Control')
    : null;
  if (cacheControl && /no-store|private/i.test(cacheControl)) return false;
  return true;
}

function buildNullBodyClone(response) {
  const headers = cloneHeaders(response.headers);
  headers.delete('content-length');
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cloneHeaders(headers) {
  const copy = new Headers();
  if (!headers || typeof headers.forEach !== 'function') return copy;
  headers.forEach((value, key) => {
    if (value === undefined || value === null) return;
    copy.append(key, value);
  });
  return copy;
}
