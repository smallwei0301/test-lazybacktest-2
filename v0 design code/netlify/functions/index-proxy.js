// netlify/functions/index-proxy.js (v1.0 - Yahoo Finance index fetcher)
// Patch Tag: LB-INDEX-YAHOO-20250726A

import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const INDEX_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小時
const INDEX_INFO_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時
const YAHOO_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';

const inMemoryCache = new Map();
const inMemoryInfoCache = new Map();
const inMemoryStores = new Map();

function createMemoryBlobStore() {
    const memory = new Map();
    return {
        async get(key) {
            return memory.get(key) || null;
        },
        async setJSON(key, value) {
            memory.set(key, value);
        },
    };
}

function obtainStore(name) {
    try {
        return getStore(name);
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            if (!inMemoryStores.has(name)) {
                console.warn('[Index Proxy] Netlify Blobs 未配置，使用記憶體快取模擬。');
                inMemoryStores.set(name, createMemoryBlobStore());
            }
            return inMemoryStores.get(name);
        }
        throw error;
    }
}

function normalizeIndexSymbol(value) {
    return (value || '').trim().toUpperCase();
}

function parseISODate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatISODate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildUnixRange(startISO, endISO) {
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    const now = new Date();
    if (!start && !end) {
        const fallbackEnd = now;
        const fallbackStart = new Date(fallbackEnd.getTime());
        fallbackStart.setUTCFullYear(fallbackEnd.getUTCFullYear() - 20);
        return {
            period1: Math.floor(fallbackStart.getTime() / 1000),
            period2: Math.floor(fallbackEnd.getTime() / 1000),
        };
    }
    const rangeStart = start || (end ? new Date(end.getTime()) : now);
    if (!start && end) {
        rangeStart.setUTCFullYear(rangeStart.getUTCFullYear() - 1);
    }
    const rangeEnd = end || now;
    if (rangeEnd < rangeStart) {
        return null;
    }
    const period1 = Math.max(0, Math.floor(rangeStart.getTime() / 1000));
    const period2 = Math.max(period1 + 86400, Math.floor(rangeEnd.getTime() / 1000) + 86400);
    return { period1, period2 };
}

function normaliseYahooNumber(value) {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

async function fetchYahooIndexRange(symbol, startISO, endISO) {
    const unixRange = buildUnixRange(startISO, endISO);
    if (!unixRange) {
        throw new Error('日期範圍無效');
    }
    const url = new URL(`${YAHOO_ENDPOINT}${encodeURIComponent(symbol)}`);
    url.searchParams.set('interval', '1d');
    url.searchParams.set('includeAdjustedClose', 'true');
    if (Number.isFinite(unixRange.period1)) {
        url.searchParams.set('period1', String(unixRange.period1));
    }
    if (Number.isFinite(unixRange.period2)) {
        url.searchParams.set('period2', String(unixRange.period2));
    }
    const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) {
        throw new Error(`Yahoo HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data?.chart?.error) {
        throw new Error(`Yahoo 回應錯誤: ${data.chart.error.description}`);
    }
    const result = data?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
        throw new Error('Yahoo 回傳資料格式異常');
    }
    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0] || {};
    const rows = [];
    for (let i = 0; i < timestamps.length; i += 1) {
        const ts = timestamps[i];
        if (!Number.isFinite(ts)) continue;
        const iso = formatISODate(new Date(ts * 1000));
        if (!iso) continue;
        rows.push({
            date: iso,
            open: normaliseYahooNumber(quote.open?.[i]),
            high: normaliseYahooNumber(quote.high?.[i]),
            low: normaliseYahooNumber(quote.low?.[i]),
            close: normaliseYahooNumber(quote.close?.[i]),
            volume: normaliseYahooNumber(quote.volume?.[i]) || 0,
        });
    }
    const stockName = result.meta?.shortName || result.meta?.longName || symbol.replace(/^\^/, '') || symbol;
    return {
        stockName,
        data: rows,
        meta: result.meta || {},
    };
}

async function fetchYahooIndexMeta(symbol) {
    const url = new URL(`${YAHOO_ENDPOINT}${encodeURIComponent(symbol)}`);
    url.searchParams.set('range', '1d');
    url.searchParams.set('interval', '1d');
    const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) {
        throw new Error(`Yahoo HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data?.chart?.error) {
        throw new Error(`Yahoo 回應錯誤: ${data.chart.error.description}`);
    }
    const result = data?.chart?.result?.[0];
    if (!result || !result.meta) {
        return null;
    }
    const meta = result.meta;
    return {
        stockName: meta.shortName || meta.longName || symbol.replace(/^\^/, '') || symbol,
        shortName: meta.shortName || null,
        longName: meta.longName || null,
        exchange: meta.exchangeName || meta.exchange || null,
        currency: meta.currency || null,
        symbol: meta.symbol || symbol,
        source: 'Yahoo Finance',
    };
}

function buildPriceCacheKey(symbol, startISO, endISO) {
    return `${symbol}|${startISO || 'NA'}|${endISO || 'NA'}`;
}

async function readPriceCache(store, cacheKey) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() - memoryHit.timestamp < INDEX_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }
    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < INDEX_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        console.warn('[Index Proxy] 讀取價格快取失敗:', error);
    }
    return null;
}

async function writePriceCache(store, cacheKey, payload) {
    const record = { timestamp: Date.now(), data: payload };
    inMemoryCache.set(cacheKey, record);
    try {
        await store.setJSON(cacheKey, record);
    } catch (error) {
        console.warn('[Index Proxy] 寫入價格快取失敗:', error);
    }
}

async function readInfoCache(store, symbol) {
    const memoryHit = inMemoryInfoCache.get(symbol);
    if (memoryHit && Date.now() - memoryHit.timestamp < INDEX_INFO_TTL_MS) {
        return memoryHit.data;
    }
    try {
        const blobHit = await store.get(symbol, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < INDEX_INFO_TTL_MS) {
            inMemoryInfoCache.set(symbol, { timestamp: Date.now(), data: blobHit });
            return blobHit;
        }
    } catch (error) {
        console.warn('[Index Proxy] 讀取指數資訊快取失敗:', error);
    }
    return null;
}

async function writeInfoCache(store, symbol, payload) {
    const record = { timestamp: Date.now(), ...payload };
    inMemoryInfoCache.set(symbol, record);
    try {
        await store.setJSON(symbol, record);
    } catch (error) {
        console.warn('[Index Proxy] 寫入指數資訊快取失敗:', error);
    }
    return record;
}

export default async (req) => {
    try {
        // [Security] Referer Check - 防止 API 盜連
        const allowedDomains = [
            'lazybacktest.netlify.app', // Netlify 網域
            'test-lazybacktest.netlify.app', // 測試網域
            'localhost',                // 本地開發
            '127.0.0.1'                 // 本地開發
            // 如果有自定義網域 (如 lazybacktest.com)，請補在這裡
        ];

        const referer = req.headers.get('referer') || req.headers.get('referrer');
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const isAllowed = allowedDomains.some(domain => refererUrl.hostname.includes(domain));

                if (!isAllowed) {
                    console.warn(`[Security Block] 阻擋來自非授權網域的請求: ${referer}`);
                    return new Response(JSON.stringify({ error: 'Forbidden: Access Denied' }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (e) {
                console.warn(`[Security Block] Malformed Referer: ${referer}`);
            }
        }

        const url = new URL(req.url);
        const params = url.searchParams;
        const mode = params.get('mode') || 'price';
        const stockParam = params.get('stockNo');
        const stockNo = normalizeIndexSymbol(stockParam);

        if (!stockNo) {
            return new Response(JSON.stringify({ error: '缺少指數代號' }), { status: 400 });
        }

        if (mode === 'info') {
            const store = obtainStore('index_info_store');
            const cached = await readInfoCache(store, stockNo);
            if (cached && cached.data) {
                return new Response(JSON.stringify(cached.data), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
                        'Netlify-CDN-Cache-Control': 'public, s-maxage=86400',
                    },
                });
            }
            const info = await fetchYahooIndexMeta(stockNo);
            const payload = info || {
                stockName: stockNo.replace(/^\^/, '') || stockNo,
                symbol: stockNo,
                source: 'Yahoo Finance',
            };
            await writeInfoCache(store, stockNo, { data: payload });
            return new Response(JSON.stringify(payload), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
                    'Netlify-CDN-Cache-Control': 'public, s-maxage=86400',
                },
            });
        }

        const start = params.get('start');
        const end = params.get('end');
        const month = params.get('month');
        let startISO = start;
        let endISO = end;
        if ((!startISO || !endISO) && month) {
            const monthSeed = parseISODate(`${month.slice(0, 4)}-${month.slice(4, 6)}-01`);
            if (monthSeed) {
                const monthStart = new Date(Date.UTC(monthSeed.getUTCFullYear(), monthSeed.getUTCMonth(), 1));
                const monthEnd = new Date(Date.UTC(monthSeed.getUTCFullYear(), monthSeed.getUTCMonth() + 1, 0));
                startISO = startISO || formatISODate(monthStart);
                endISO = endISO || formatISODate(monthEnd);
            }
        }

        const cacheKey = buildPriceCacheKey(stockNo, startISO, endISO);
        const store = obtainStore('index_price_store');
        const bypassCache = params.has('cacheBust');

        if (!bypassCache) {
            const cached = await readPriceCache(store, cacheKey);
            if (cached) {
                // [Dynamic Caching Strategy]
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // Safety: If endISO is missing or invalid, default to current time (Active Data)
                let endDateObj = new Date();
                if (endISO) {
                    const parsed = new Date(endISO);
                    if (!Number.isNaN(parsed.getTime())) {
                        endDateObj = parsed;
                    }
                }
                const isHistorical = endDateObj < today;
                const cacheTTL = isHistorical ? 31536000 : 3600;
                const cacheControlHeader = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}${isHistorical ? ', immutable' : ''}`;

                return new Response(JSON.stringify(cached.data), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': cacheControlHeader,
                        'Netlify-CDN-Cache-Control': `public, s-maxage=${cacheTTL}`,
                    },
                });
            }
        }

        const yahooPayload = await fetchYahooIndexRange(stockNo, startISO, endISO);
        const responsePayload = {
            stockName: yahooPayload.stockName || stockNo,
            data: Array.isArray(yahooPayload.data) ? yahooPayload.data : [],
            dataSource: 'Yahoo Finance (Index)',
            source: 'Yahoo Finance',
        };
        await writePriceCache(store, cacheKey, { data: responsePayload });
        // [Dynamic Caching Strategy]
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Safety: If endISO is missing or invalid, default to current time (Active Data)
        let endDateObj = new Date();
        if (endISO) {
            const parsed = new Date(endISO);
            if (!Number.isNaN(parsed.getTime())) {
                endDateObj = parsed;
            }
        }
        const isHistorical = endDateObj < today;
        const cacheTTL = isHistorical ? 31536000 : 3600;
        const cacheControlHeader = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}${isHistorical ? ', immutable' : ''}`;

        return new Response(JSON.stringify(responsePayload), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': cacheControlHeader,
                'Netlify-CDN-Cache-Control': `public, s-maxage=${cacheTTL}`,
            },
        });
    } catch (error) {
        console.error('[Index Proxy] 發生錯誤:', error);
        return new Response(JSON.stringify({ error: error?.message || 'Index Proxy error' }), { status: 502 });
    }
};
