// netlify/functions/us-proxy.js (v1.2 - FinMind primary with Yahoo fallback)
// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-US-YAHOO-20250613A
// Patch Tag: LB-US-NAMEFIX-20250614A

import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const US_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時
const US_INFO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const FINMIND_LEVEL_PATTERN = /your level is register/i;
const FINMIND_SOURCE_LABEL = 'FinMind (US)';
const YAHOO_SOURCE_LABEL = 'Yahoo Finance (US)';
const YAHOO_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';

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
                console.warn('[US Proxy v1.1] Netlify Blobs 未配置，使用記憶體快取模擬。');
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

function normalizeUsComparisonKey(value) {
    const normalized = normalizeStockNo(value);
    if (!normalized) return null;
    return normalized
        .replace(/^US[:.]/i, '')
        .replace(/\.US$/i, '')
        .replace(/-US$/i, '')
        .replace(/\s+/g, '');
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

function toUnixTimestamp(date, options = {}) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const clone = new Date(date.getTime());
    if (options.endOfDay) {
        clone.setUTCHours(23, 59, 59, 999);
    } else {
        clone.setUTCHours(0, 0, 0, 0);
    }
    return Math.floor(clone.getTime() / 1000);
}

function formatYahooDate(timestamp) {
    if (!Number.isFinite(timestamp)) return null;
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return formatISODate(date);
}

function normalizeYahooNumber(value) {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
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
        console.error('[US Proxy v1.1] 讀取 Blobs 時發生錯誤:', error);
    }
    return null;
}

async function writeCache(store, cacheKey, payload) {
    const record = { timestamp: Date.now(), data: payload };
    inMemoryCache.set(cacheKey, record);
    try {
        await store.setJSON(cacheKey, record);
    } catch (error) {
        console.error('[US Proxy v1.1] 寫入 Blobs 失敗:', error);
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
        console.error('[US Proxy v1.1] 讀取 USStockInfo Blobs 失敗:', error);
    }
    return null;
}

async function writeInfoCache(store, stockNo, payload) {
    const record = { timestamp: Date.now(), data: payload };
    inMemoryInfoCache.set(stockNo, record);
    try {
        await store.setJSON(stockNo, record);
    } catch (error) {
        console.error('[US Proxy v1.1] 寫入 USStockInfo Blobs 失敗:', error);
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

function findUSStockInfoRecord(data, stockNo) {
    if (!Array.isArray(data)) return null;
    const normalizedTarget = normalizeStockNo(stockNo);
    if (!normalizedTarget) return null;
    const targetCore = normalizeUsComparisonKey(normalizedTarget) || normalizedTarget;

    const candidateFields = [
        'stock_id',
        'stockId',
        'data_id',
        'dataId',
        'ticker',
        'symbol',
        'stock_code',
        'code',
    ];

    for (const row of data) {
        if (!row) continue;
        for (const field of candidateFields) {
            const rawValue = row[field];
            if (!rawValue) continue;
            const normalized = normalizeStockNo(rawValue);
            if (normalized && normalized === normalizedTarget) {
                return {
                    row,
                    matchStrategy: `field=${field} exact`,
                    resolvedSymbol: normalized,
                };
            }
            const normalizedCore = normalizeUsComparisonKey(rawValue);
            if (normalizedCore && normalizedCore === targetCore) {
                return {
                    row,
                    matchStrategy: `field=${field} normalized`,
                    resolvedSymbol: normalizedCore,
                };
            }
        }
    }

    if (data.length === 1 && data[0]) {
        return {
            row: data[0],
            matchStrategy: 'single-record fallback',
            resolvedSymbol: normalizeStockNo(
                data[0].stock_id
                || data[0].stockId
                || data[0].data_id
                || data[0].dataId
                || data[0].ticker
                || data[0].symbol
            ),
        };
    }

    return null;
}

function extractUSStockMetadata(data, stockNo) {
    const matched = findUSStockInfoRecord(data, stockNo);
    if (!matched || !matched.row) return null;
    const { row, matchStrategy, resolvedSymbol } = matched;
    const stockName = row.stock_name || row.stockName || row.stock_name_en || row.name || null;
    const marketCategory = row.market_category || row.marketCategory || row.exchange || row.market || null;
    const securityType = row.security_type || row.securityType || row.type || row.stock_type || null;
    const symbol = normalizeStockNo(
        row.stock_id
        || row.stockId
        || row.data_id
        || row.dataId
        || row.ticker
        || row.symbol
        || resolvedSymbol
        || stockNo
    );
    return {
        stockName: stockName || stockNo,
        symbol: symbol || stockNo,
        marketCategory: marketCategory || null,
        securityType: securityType || null,
        matchStrategy: matchStrategy || null,
        resolvedSymbol: resolvedSymbol || symbol || null,
        source: FINMIND_SOURCE_LABEL,
    };
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
                console.warn('[US Proxy v1.1] USStockInfo data_id 查無資料，stock_id fallback 亦失敗:', fallbackError);
            }
        }
        const metadata = extractUSStockMetadata(data, normalized) || null;
        const payload = {
            stockNo: normalized,
            stockName: metadata?.stockName || normalized,
            symbol: metadata?.symbol || normalized,
            marketCategory: metadata?.marketCategory || null,
            securityType: metadata?.securityType || null,
            matchStrategy: metadata?.matchStrategy || null,
            resolvedSymbol: metadata?.resolvedSymbol || null,
            source: metadata?.source || FINMIND_SOURCE_LABEL,
        };
        await writeInfoCache(store, normalized, payload);
        return payload;
    } catch (error) {
        console.error('[US Proxy v1.1] 取得 USStockInfo 失敗:', error);
        return {
            stockNo: normalized,
            stockName: normalized,
            symbol: normalized,
            source: FINMIND_SOURCE_LABEL,
        };
    }
}

function buildCacheKey(stockNo, rangeKey, options = {}) {
    const sourceSuffix = options.forceSource ? `_${options.forceSource}` : '';
    return `${stockNo}_${rangeKey}${sourceSuffix}`;
}

function buildRangeKey(startISO, endISO) {
    return `${startISO}_${endISO}`;
}

async function fetchYahooFinanceRange(stockNo, startISO, endISO) {
    const startDate = parseISODate(startISO);
    const endDate = parseISODate(endISO);
    if (!startDate || !endDate) {
        throw new Error('Yahoo Finance 日期參數無效');
    }
    const period1 = toUnixTimestamp(startDate, { endOfDay: false });
    const period2Base = toUnixTimestamp(endDate, { endOfDay: true });
    if (!Number.isFinite(period1) || !Number.isFinite(period2Base)) {
        throw new Error('Yahoo Finance 無法轉換日期');
    }
    const period2 = period2Base + 86400; // 延伸一天確保涵蓋結束日期
    const url = new URL(`${YAHOO_ENDPOINT}${encodeURIComponent(stockNo)}`);
    url.searchParams.set('interval', '1d');
    url.searchParams.set('includePrePost', 'false');
    url.searchParams.set('events', 'div,splits');
    url.searchParams.set('period1', period1);
    url.searchParams.set('period2', period2);

    const response = await fetch(url.toString(), {
        headers: {
            'User-Agent': 'Mozilla/5.0 (LazyBacktest)'
        },
    });
    if (!response.ok) {
        throw new Error(`Yahoo Finance HTTP ${response.status}`);
    }
    const payload = await response.json();
    const chart = payload?.chart;
    if (!chart) {
        throw new Error('Yahoo Finance 回應格式異常');
    }
    if (chart.error) {
        throw new Error(chart.error.description || chart.error.code || 'Yahoo Finance 查詢失敗');
    }
    const result = Array.isArray(chart.result) ? chart.result[0] : null;
    if (!result) return [];
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const quote = result?.indicators?.quote?.[0] || {};
    const opens = Array.isArray(quote.open) ? quote.open : [];
    const highs = Array.isArray(quote.high) ? quote.high : [];
    const lows = Array.isArray(quote.low) ? quote.low : [];
    const closes = Array.isArray(quote.close) ? quote.close : [];
    const volumes = Array.isArray(quote.volume) ? quote.volume : [];
    const rows = [];
    for (let i = 0; i < timestamps.length; i += 1) {
        const iso = formatYahooDate(timestamps[i]);
        if (!iso) continue;
        const open = normalizeYahooNumber(opens[i]);
        const high = normalizeYahooNumber(highs[i]);
        const low = normalizeYahooNumber(lows[i]);
        const close = normalizeYahooNumber(closes[i]);
        const volume = normalizeYahooNumber(volumes[i]);
        if (open === null && high === null && low === null && close === null) continue;
        rows.push({
            date: iso,
            open,
            high,
            low,
            close,
            volume: volume ?? 0,
        });
    }
    return rows;
}

async function fetchUSPriceRange(stockNo, startISO, endISO, options = {}) {
    const normalized = normalizeStockNo(stockNo);
    if (!normalized) {
        return {
            rows: [],
            primarySource: FINMIND_SOURCE_LABEL,
            sources: [],
        };
    }

    const forceSource = (options.forceSource || '').toLowerCase();
    const allowFinMind = forceSource !== 'yahoo';
    const allowYahoo = forceSource !== 'finmind';

    let finmindRows = null;
    let finmindError = null;
    let finmindEmpty = false;
    const finmindAttempted = allowFinMind;

    if (allowFinMind) {
        try {
            const data = await fetchFinMindData('USStockPrice', {
                data_id: normalized,
                start_date: startISO,
                end_date: endISO,
            });
            finmindRows = Array.isArray(data) ? data : [];
            if (finmindRows.length > 0 || forceSource === 'finmind') {
                return {
                    rows: finmindRows,
                    primarySource: FINMIND_SOURCE_LABEL,
                    sources: [FINMIND_SOURCE_LABEL],
                };
            }
            finmindEmpty = true;
        } catch (error) {
            finmindError = error;
            console.warn(`[US Proxy v1.1] FinMind 取得 ${normalized} 失敗:`, error);
            if (forceSource === 'finmind') {
                throw error;
            }
        }
    }

    if (!allowYahoo) {
        return {
            rows: Array.isArray(finmindRows) ? finmindRows : [],
            primarySource: FINMIND_SOURCE_LABEL,
            sources: [FINMIND_SOURCE_LABEL],
            fallback: finmindEmpty
                ? { source: FINMIND_SOURCE_LABEL, reason: 'FinMind 無資料' }
                : finmindError
                    ? { source: FINMIND_SOURCE_LABEL, reason: finmindError.message }
                    : null,
        };
    }

    let yahooRows = [];
    let yahooError = null;
    try {
        yahooRows = await fetchYahooFinanceRange(normalized, startISO, endISO);
    } catch (error) {
        yahooError = error;
        console.error(`[US Proxy v1.1] Yahoo Finance 取得 ${normalized} 失敗:`, error);
    }

    if (Array.isArray(yahooRows) && yahooRows.length > 0) {
        const fallbackInfo = finmindAttempted && (finmindError || finmindEmpty)
            ? {
                source: FINMIND_SOURCE_LABEL,
                reason: finmindError ? finmindError.message : 'FinMind 無資料',
            }
            : null;
        if (fallbackInfo) {
            console.warn(`[US Proxy v1.1] ${normalized} 改用 Yahoo Finance 備援，原因: ${fallbackInfo.reason}`);
        }
        return {
            rows: yahooRows,
            primarySource: YAHOO_SOURCE_LABEL,
            sources: [YAHOO_SOURCE_LABEL],
            fallback: fallbackInfo,
        };
    }

    if (yahooError) {
        if (finmindError) {
            throw new Error(`FinMind 取得失敗 (${finmindError.message}); Yahoo Finance 取得失敗 (${yahooError.message})`);
        }
        if (finmindEmpty) {
            throw new Error(`FinMind 無資料且 Yahoo Finance 取得失敗 (${yahooError.message})`);
        }
        throw yahooError;
    }

    if (Array.isArray(finmindRows) && finmindRows.length > 0) {
        return {
            rows: finmindRows,
            primarySource: FINMIND_SOURCE_LABEL,
            sources: [FINMIND_SOURCE_LABEL],
        };
    }

    if (finmindError) {
        throw finmindError;
    }

    return {
        rows: [],
        primarySource: FINMIND_SOURCE_LABEL,
        sources: [FINMIND_SOURCE_LABEL],
        fallback: finmindEmpty
            ? { source: FINMIND_SOURCE_LABEL, reason: 'FinMind 無資料' }
            : null,
    };
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
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=604800, s-maxage=604800',
                    'Netlify-CDN-Cache-Control': 'public, s-maxage=604800',
                },
            });
        }

        const forceSourceParam = params.get('forceSource');
        const normalizedForceSource = forceSourceParam ? forceSourceParam.toLowerCase() : null;
        if (normalizedForceSource && !['finmind', 'yahoo'].includes(normalizedForceSource)) {
            return new Response(JSON.stringify({ error: 'forceSource 僅支援 finmind 或 yahoo' }), { status: 400 });
        }

        const range = resolveDateRange(params.get('start'), params.get('end'), params.get('month'));
        if (!range || !range.startISO || !range.endISO) {
            return new Response(JSON.stringify({ error: '日期範圍無效' }), { status: 400 });
        }

        const cacheKey = buildCacheKey(stockNo, buildRangeKey(range.startISO, range.endISO), {
            forceSource: normalizedForceSource || undefined,
        });
        const store = obtainStore('us_price_store');
        const cacheBypassed = params.has('cacheBust');

        let payload = null;
        if (!cacheBypassed) {
            payload = await readCache(store, cacheKey);
        }

        if (!payload) {
            const priceResult = await fetchUSPriceRange(stockNo, range.startISO, range.endISO, {
                forceSource: normalizedForceSource || undefined,
            });
            const info = await fetchUSStockInfo(stockNo);
            const dataRows = Array.isArray(priceResult.rows) ? priceResult.rows : [];
            const primarySource = priceResult.primarySource || FINMIND_SOURCE_LABEL;
            const sourceListRaw = Array.isArray(priceResult.sources) && priceResult.sources.length > 0
                ? priceResult.sources
                : [primarySource];
            const sourceList = Array.from(new Set(sourceListRaw.filter(Boolean)));
            payload = {
                stockName: info.stockName || stockNo,
                stockInfo: info,
                data: dataRows.map((row) => ({
                    date: row.date,
                    open: row.open ?? row.Open ?? null,
                    high: row.high ?? row.High ?? row.max ?? null,
                    low: row.low ?? row.Low ?? row.min ?? null,
                    close: row.close ?? row.Close ?? null,
                    volume: row.volume ?? row.Volume ?? row.Trading_Volume ?? 0,
                })),
                dataSource: primarySource,
                dataSources: sourceList,
                fallback: priceResult.fallback || null,
                source: primarySource,
            };
            await writeCache(store, cacheKey, payload);
        }

        // [Dynamic Caching Strategy]
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isHistorical = range && range.end < today;
        const cacheTTL = isHistorical ? 31536000 : 3600;
        const cacheControlHeader = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}${isHistorical ? ', immutable' : ''}`;

        return new Response(
            JSON.stringify({
                stockName: payload.stockName || stockNo,
                stockInfo: payload.stockInfo || null,
                data: Array.isArray(payload.data) ? payload.data : [],
                dataSource: payload.dataSource || FINMIND_SOURCE_LABEL,
                dataSources: Array.isArray(payload.dataSources) ? payload.dataSources : undefined,
                fallback: payload.fallback || null,
                source: payload.source || payload.dataSource || null,
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': cacheControlHeader,
                    'Netlify-CDN-Cache-Control': `public, s-maxage=${cacheTTL}`,
                },
            },
        );
    } catch (error) {
        console.error('[US Proxy v1.1] 發生錯誤:', error);
        return new Response(
            JSON.stringify({ error: error?.message || 'US Proxy error' }),
            { status: error?.message === '未設定 FinMind Token' ? 500 : 502 },
        );
    }
};
