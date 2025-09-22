// netlify/functions/us-proxy.js (v1.0 - FinMind US market bridge)
// Patch Tag: LB-US-MARKET-20250612A

import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const US_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時
const US_INFO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const FINMIND_LEVEL_PATTERN = /your level is register/i;

const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>
const inMemoryInfoCache = new Map(); // Map<stockNo, { timestamp, data }>
const inMemoryStores = new Map(); // Map<storeName, MemoryStore>

function createMemoryBlobStore() {
    const memory = new Map();
    return {
        async get(key, options = {}) {
            if (options.type === 'json') return memory.get(key) || null;
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
                console.warn('[US Proxy v1.0] Netlify Blobs 未配置，使用記憶體快取模擬。');
                inMemoryStores.set(name, createMemoryBlobStore());
            }
            return inMemoryStores.get(name);
        }
        throw error;
    }
}

function normaliseFinMindErrorMessage(message) {
    if (!message) return 'FinMind 回應異常';
    if (FINMIND_LEVEL_PATTERN.test(message)) {
        return 'FinMind 帳號等級為 Register，請升級 Sponsor 方案後再查詢美股資料。';
    }
    return message;
}

function normalizeStockNo(value) {
    return (value || '').trim().toUpperCase();
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function parseISODate(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (/^\d{6}$/.test(trimmed)) {
        const year = Number(trimmed.slice(0, 4));
        const month = Number(trimmed.slice(4)) - 1;
        const parsed = new Date(year, month, 1);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function formatISODate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = pad2(date.getUTCMonth() + 1);
    const day = pad2(date.getUTCDate());
    return `${year}-${month}-${day}`;
}

function resolveDateRange(startParam, endParam, monthParam) {
    let start = parseISODate(startParam);
    let end = parseISODate(endParam);

    if (!start || !end) {
        const monthSeed = parseISODate(monthParam);
        if (!monthSeed) return null;
        const monthStart = new Date(monthSeed.getFullYear(), monthSeed.getMonth(), 1);
        const monthEnd = new Date(monthSeed.getFullYear(), monthSeed.getMonth() + 1, 0);
        start = monthStart;
        end = monthEnd;
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return null;
    }

    return {
        start,
        end,
        startISO: formatISODate(start),
        endISO: formatISODate(end),
    };
}

async function readCache(store, cacheKey) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() - memoryHit.timestamp < US_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }

    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < US_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        console.error('[US Proxy v1.0] 讀取 Blobs 時發生錯誤:', error);
    }
    return null;
}

async function writeCache(store, cacheKey, payload) {
    const record = { timestamp: Date.now(), data: payload };
    inMemoryCache.set(cacheKey, record);
    try {
        await store.setJSON(cacheKey, record);
    } catch (error) {
        console.error('[US Proxy v1.0] 寫入 Blobs 失敗:', error);
    }
}

async function readInfoCache(store, stockNo) {
    const memoryHit = inMemoryInfoCache.get(stockNo);
    if (memoryHit && Date.now() - memoryHit.timestamp < US_INFO_TTL_MS) {
        return memoryHit.data;
    }
    try {
        const blobHit = await store.get(stockNo, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < US_INFO_TTL_MS) {
            inMemoryInfoCache.set(stockNo, { timestamp: Date.now(), data: blobHit.data });
            return blobHit.data;
        }
    } catch (error) {
        console.error('[US Proxy v1.0] 讀取 USStockInfo Blobs 失敗:', error);
    }
    return null;
}

async function writeInfoCache(store, stockNo, payload) {
    const record = { timestamp: Date.now(), data: payload };
    inMemoryInfoCache.set(stockNo, record);
    try {
        await store.setJSON(stockNo, record);
    } catch (error) {
        console.error('[US Proxy v1.0] 寫入 USStockInfo Blobs 失敗:', error);
    }
}

async function fetchFinMindData(dataset, params) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const url = new URL('https://api.finmindtrade.com/api/v4/data');
    url.searchParams.set('dataset', dataset);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    url.searchParams.set('token', token);

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`FinMind HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.status !== 200) {
        throw new Error(normaliseFinMindErrorMessage(json.msg));
    }
    return Array.isArray(json.data) ? json.data : [];
}

function extractUSStockName(data, stockNo) {
    if (!Array.isArray(data)) return null;
    const match = data.find((row) => {
        const id = row?.stock_id || row?.stockId || row?.data_id || row?.dataId;
        return id && normalizeStockNo(id) === stockNo;
    }) || data[0];
    if (!match) return null;
    return match.stock_name || match.stockName || match.stock_name_en || match.name || null;
}

async function fetchUSStockInfo(stockNo) {
    const normalized = normalizeStockNo(stockNo);
    if (!normalized) return { stockNo, stockName: stockNo };
    const store = obtainStore('us_info_store');
    const cacheHit = await readInfoCache(store, normalized);
    if (cacheHit?.stockName) {
        return cacheHit;
    }

    try {
        let data = await fetchFinMindData('USStockInfo', {
            data_id: normalized,
        });
        if ((!Array.isArray(data) || data.length === 0) && normalized) {
            try {
                data = await fetchFinMindData('USStockInfo', {
                    stock_id: normalized,
                });
            } catch (fallbackError) {
                console.warn('[US Proxy v1.0] USStockInfo data_id 查無資料，stock_id fallback 亦失敗:', fallbackError);
            }
        }
        const stockName = extractUSStockName(data, normalized) || normalized;
        const payload = { stockNo: normalized, stockName };
        await writeInfoCache(store, normalized, payload);
        return payload;
    } catch (error) {
        console.error('[US Proxy v1.0] 取得 USStockInfo 失敗:', error);
        return { stockNo: normalized, stockName: normalized };
    }
}

async function fetchUSPriceRange(stockNo, startISO, endISO) {
    const normalized = normalizeStockNo(stockNo);
    const data = await fetchFinMindData('USStockPrice', {
        data_id: normalized,
        start_date: startISO,
        end_date: endISO,
    });
    return Array.isArray(data) ? data : [];
}

function buildCacheKey(stockNo, rangeKey) {
    return `${stockNo}_${rangeKey}`;
}

function buildRangeKey(startISO, endISO) {
    return `${startISO}_${endISO}`;
}

export default async (req) => {
    try {
        const params = new URL(req.url).searchParams;
        const mode = params.get('mode') || 'price';
        const stockNoParam = params.get('stockNo');
        const stockNo = normalizeStockNo(stockNoParam);

        if (!stockNo) {
            return new Response(JSON.stringify({ error: '缺少股票代號' }), { status: 400 });
        }

        if (mode === 'info') {
            const info = await fetchUSStockInfo(stockNo);
            return new Response(JSON.stringify(info), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const forceSource = params.get('forceSource');
        if (forceSource && forceSource.toLowerCase() !== 'finmind') {
            return new Response(JSON.stringify({ error: '美股資料僅支援 FinMind 來源' }), { status: 400 });
        }

        const range = resolveDateRange(params.get('start'), params.get('end'), params.get('month'));
        if (!range || !range.startISO || !range.endISO) {
            return new Response(JSON.stringify({ error: '日期範圍無效' }), { status: 400 });
        }

        const cacheKey = buildCacheKey(stockNo, buildRangeKey(range.startISO, range.endISO));
        const store = obtainStore('us_price_store');
        const cacheBypassed = params.has('cacheBust');

        let payload = null;
        if (!cacheBypassed) {
            payload = await readCache(store, cacheKey);
        }

        if (!payload) {
            const priceRows = await fetchUSPriceRange(stockNo, range.startISO, range.endISO);
            const info = await fetchUSStockInfo(stockNo);
            payload = {
                stockName: info.stockName || stockNo,
                data: priceRows.map((row) => ({
                    date: row.date,
                    open: row.open ?? row.Open ?? null,
                    high: row.high ?? row.High ?? row.max ?? null,
                    low: row.low ?? row.Low ?? row.min ?? null,
                    close: row.close ?? row.Close ?? null,
                    volume: row.volume ?? row.Volume ?? row.Trading_Volume ?? 0,
                })),
                dataSource: 'FinMind (US)',
            };
            await writeCache(store, cacheKey, payload);
        }

        return new Response(
            JSON.stringify({
                stockName: payload.stockName || stockNo,
                data: Array.isArray(payload.data) ? payload.data : [],
                dataSource: payload.dataSource || 'FinMind (US)',
                source: payload.source || null,
            }),
            {
                headers: { 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        console.error('[US Proxy v1.0] 發生錯誤:', error);
        return new Response(
            JSON.stringify({ error: error?.message || 'US Proxy error' }),
            { status: error?.message === '未設定 FinMind Token' ? 500 : 502 },
        );
    }
};
