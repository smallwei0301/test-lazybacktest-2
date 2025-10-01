// netlify/functions/taiwan-directory.js (v1.0 - Taiwan directory cache)
// Patch Tag: LB-TW-DIRECTORY-20250620A

import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const DIRECTORY_STORE_NAME = 'taiwan_directory_store_v1';
const DIRECTORY_CACHE_KEY = 'directory-cache.json';
const DIRECTORY_VERSION = 'LB-TW-DIRECTORY-20250620A';
const DIRECTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時
const FINMIND_ENDPOINT = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_DATASET = 'TaiwanStockInfo';
const FUGLE_SYMBOLS_URL = 'https://api.fugle.tw/marketdata/v1.0/meta/symbols';

const inMemoryStores = new Map();

function createMemoryStore() {
    const memory = new Map();
    return {
        async get(key, options = {}) {
            if (options.type === 'json') {
                return memory.get(key) || null;
            }
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
                console.warn('[Taiwan Directory] Netlify Blobs 未配置，使用記憶體快取模擬。');
                inMemoryStores.set(name, createMemoryStore());
            }
            return inMemoryStores.get(name);
        }
        throw error;
    }
}

async function readCache(store, cacheKey) {
    try {
        const cached = await store.get(cacheKey, { type: 'json' });
        if (!cached) return null;
        return cached;
    } catch (error) {
        console.error('[Taiwan Directory] 讀取快取失敗:', error);
        return null;
    }
}

async function writeCache(store, cacheKey, payload) {
    try {
        await store.setJSON(cacheKey, payload);
    } catch (error) {
        console.error('[Taiwan Directory] 寫入快取失敗:', error);
    }
}

function normaliseMarketInfo(row) {
    const stockId = (row.stock_id || row.stockId || '').toString().trim().toUpperCase();
    const typeValue = (row.type || row.market || '').toString().trim();
    const industry = (row.industry_category || row.industry || '').toString().trim() || null;

    const typeLower = typeValue.toLowerCase();
    let market = null;
    if (typeLower.includes('twse') || typeLower.includes('上市') || typeLower === 'sii' || typeLower === 'stock') {
        market = 'TWSE';
    } else if (typeLower.includes('tpex') || typeLower.includes('otc') || typeLower.includes('上櫃') || typeLower === 'rotc' || typeLower === 'emerging') {
        market = 'TPEX';
    }

    if (!market) {
        if (/^[0-9]{4}$/.test(stockId)) {
            market = 'TWSE';
        } else if (/^[0-9]{4}[A-Z]$/.test(stockId) || /^[A-Z]{1,2}\d{3,4}$/.test(stockId)) {
            market = 'TPEX';
        }
    }

    const isETF = /etf/i.test(typeValue) || /^00\d{2,4}$/.test(stockId);
    const instrumentType = isETF ? 'ETF' : null;
    const board = market === 'TWSE' ? '上市' : market === 'TPEX' ? '上櫃' : null;

    return {
        stockId,
        name: (row.stock_name || row.name || '').toString().trim(),
        market,
        board,
        industry,
        instrumentType,
        isETF,
        rawType: typeValue || null,
    };
}

function normaliseIndexInfo(item) {
    const symbol = (item.symbol || item.symbolId || '').toString().trim().toUpperCase();
    if (!symbol) return null;
    const name = (item.name || '').toString().trim() || symbol;
    return {
        stockId: symbol,
        name,
        market: 'INDEX',
        board: '指數',
        industry: null,
        instrumentType: 'INDEX',
        isETF: false,
        rawType: item.type || 'INDEX',
        source: 'Fugle 指數清單',
    };
}

async function fetchFugleIndexSymbols() {
    const token = process.env.FUGLE_API_TOKEN;
    if (!token) {
        return [];
    }
    try {
        const url = new URL(FUGLE_SYMBOLS_URL);
        url.searchParams.set('type', 'INDEX');
        url.searchParams.set('apiToken', token);
        const response = await fetch(url.toString(), { timeout: 15000 });
        if (!response.ok) {
            const text = await response.text();
            console.warn(`[Taiwan Directory] Fugle 指數清單 HTTP ${response.status}: ${text.slice(0, 120)}`);
            return [];
        }
        const payload = await response.json();
        if (!payload || !Array.isArray(payload.data)) {
            return [];
        }
        return payload.data
            .map((item) => normaliseIndexInfo(item))
            .filter((entry) => entry && entry.stockId && entry.name);
    } catch (error) {
        console.warn('[Taiwan Directory] 取得 Fugle 指數清單失敗:', error);
        return [];
    }
}

async function fetchTaiwanDirectoryFromFinMind() {
    const params = new URLSearchParams({ dataset: FINMIND_DATASET });
    if (process.env.FINMIND_TOKEN) {
        params.set('token', process.env.FINMIND_TOKEN);
    }
    const url = `${FINMIND_ENDPOINT}?${params.toString()}`;
    const response = await fetch(url, { timeout: 15000 });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`FinMind 回傳狀態 ${response.status} ｜ ${text.slice(0, 200)}`);
    }
    const payload = await response.json();
    if (!payload || payload.error || payload.status === 429) {
        const message = payload?.msg || payload?.message || 'FinMind 回應異常';
        throw new Error(message);
    }
    if (!Array.isArray(payload.data)) {
        throw new Error('FinMind TaiwainStockInfo 缺少資料陣列');
    }
    const baseEntries = payload.data
        .map((row) => normaliseMarketInfo(row))
        .filter((entry) => entry && entry.stockId && entry.name);

    const fugleIndexEntries = await fetchFugleIndexSymbols();
    const mergedMap = new Map();
    baseEntries.forEach((entry) => {
        if (!mergedMap.has(entry.stockId)) {
            mergedMap.set(entry.stockId, entry);
        }
    });
    fugleIndexEntries.forEach((entry) => {
        if (!mergedMap.has(entry.stockId)) {
            mergedMap.set(entry.stockId, entry);
        }
    });

    const mergedEntries = Array.from(mergedMap.values());
    const sourceLabels = ['FinMind TaiwanStockInfo'];
    if (fugleIndexEntries.length > 0) {
        sourceLabels.push('Fugle 指數清單');
    }

    return {
        entries: mergedEntries,
        source: sourceLabels.join(' + '),
        fetchedAt: new Date().toISOString(),
    };
}

function filterEntriesById(entries, stockId) {
    if (!stockId) return entries;
    return entries.filter((entry) => entry.stockId === stockId);
}

function buildResponseBody(basePayload, options = {}) {
    const entries = Array.isArray(basePayload.entries) ? basePayload.entries : [];
    const filteredEntries = filterEntriesById(entries, options.stockId);
    const data = Object.fromEntries(filteredEntries.map((entry) => [entry.stockId, entry]));

    return {
        status: 'ok',
        version: DIRECTORY_VERSION,
        updatedAt: basePayload.fetchedAt || null,
        source: basePayload.source || 'FinMind TaiwanStockInfo',
        cache: {
            refreshed: Boolean(options.refreshed),
            store: options.cacheStore || null,
            hit: Boolean(options.cacheHit),
        },
        entryCount: filteredEntries.length,
        data,
    };
}

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: 'Method Not Allowed' }),
        };
    }

    const params = event.queryStringParameters || {};
    const forceRefresh = params.force === '1' || params.refresh === '1';
    const stockId = params.stockId ? params.stockId.trim().toUpperCase() : null;

    const store = obtainStore(DIRECTORY_STORE_NAME);
    let cached = await readCache(store, DIRECTORY_CACHE_KEY);
    let cacheHit = false;
    const isMemoryStore = inMemoryStores.get(DIRECTORY_STORE_NAME) === store;
    let cacheStore = cached ? (isMemoryStore ? 'memory' : 'blob') : null;

    const now = Date.now();
    const cacheFresh = cached && cached.timestamp && now - cached.timestamp < DIRECTORY_TTL_MS;

    let refreshed = false;

    if (!forceRefresh && cacheFresh) {
        cacheHit = true;
    } else {
        try {
            const fresh = await fetchTaiwanDirectoryFromFinMind();
            cached = {
                timestamp: Date.now(),
                ...fresh,
            };
            await writeCache(store, DIRECTORY_CACHE_KEY, cached);
            cacheStore = isMemoryStore ? 'memory' : 'blob';
            refreshed = true;
        } catch (error) {
            console.error('[Taiwan Directory] 無法刷新資料:', error);
            if (!cached) {
                return {
                    statusCode: 502,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'error', message: error.message || '抓取台股官方清單失敗' }),
                };
            }
        }
    }

    if (!cached) {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: '查無台股官方清單' }),
        };
    }

    const body = buildResponseBody(cached, {
        stockId,
        refreshed,
        cacheStore,
        cacheHit,
    });

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
};
