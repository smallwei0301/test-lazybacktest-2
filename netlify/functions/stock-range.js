// netlify/functions/stock-range.js
// Consolidated range endpoint to batch month-level fetches and cache merged results.
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TWSE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TPEX_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RANGE_TTL_MS = 12 * 60 * 60 * 1000; // refresh merged cache every 12 hours

const inFlightTwseMonthCache = new Map(); // per-invocation memoization to avoid duplicate fetches

const isQuotaError = (error) => Boolean(error && (error.status === 402 || error.status === 429));

function normalizeMarketType(marketType = 'TWSE') {
    const upper = String(marketType).toUpperCase();
    if (upper.includes('TPEX') || upper.includes('OTC') || upper.includes('TWO')) return 'TPEX';
    return 'TWSE';
}

function parseISODate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatRocDateToIso(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;
    const [, rocYearStr, monthStr, dayStr] = match;
    const year = parseInt(rocYearStr, 10) + 1911;
    const month = String(parseInt(monthStr, 10)).padStart(2, '0');
    const day = String(parseInt(dayStr, 10)).padStart(2, '0');
    if (!Number.isFinite(year)) return null;
    return `${year}-${month}-${day}`;
}

function buildMonthKeyList(startDate, endDate) {
    const months = [];
    if (!startDate || !endDate) return months;
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const limit = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    while (cursor <= limit) {
        const year = cursor.getUTCFullYear();
        const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
        months.push(`${year}${month}01`);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    if (months.length === 0) {
        const year = startDate.getUTCFullYear();
        const month = String(startDate.getUTCMonth() + 1).padStart(2, '0');
        months.push(`${year}${month}01`);
    }
    return months;
}

function safeParseFloat(value) {
    if (value === null || value === undefined) return null;
    const num = parseFloat(String(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : null;
}

function safeParseInt(value) {
    if (value === null || value === undefined) return null;
    const num = parseInt(String(value).replace(/,/g, ''), 10);
    return Number.isFinite(num) ? num : null;
}

async function fetchTwseMonth({ store, stockNo, monthKey }) {
    const cacheKey = `${stockNo}_${monthKey}`;
    if (inFlightTwseMonthCache.has(cacheKey)) {
        return inFlightTwseMonthCache.get(cacheKey);
    }

    const resolver = (async () => {
        try {
            const cached = await store.get(cacheKey, { type: 'json' });
            if (cached && cached.data && (Date.now() - cached.timestamp < TWSE_TTL_MS)) {
                const base = cached.data;
                return {
                    stockName: base.stockName || stockNo,
                    iTotalRecords: base.iTotalRecords ?? (Array.isArray(base.aaData) ? base.aaData.length : 0),
                    aaData: Array.isArray(base.aaData) ? base.aaData : [],
                    dataSource: `${base.dataSource || 'TWSE'} (cache)`
                };
            }
        } catch (error) {
            if (!isQuotaError(error)) {
                console.warn(`[TWSE Range] Cache read miss for ${cacheKey}:`, error);
            }
        }

        const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${monthKey}&stockNo=${stockNo}`;
        const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) {
            throw new Error(`TWSE HTTP ${response.status}`);
        }
        const data = await response.json();

        let stockName = stockNo;
        let aaData = [];
        if (data.stat === 'OK' && Array.isArray(data.data)) {
            stockName = data.title ? data.title.split(' ')[2] || stockNo : stockNo;
            aaData = data.data.map(item => {
                if (!Array.isArray(item) || item.length < 9) return null;
                const open = safeParseFloat(item[3]);
                const high = safeParseFloat(item[4]);
                const low = safeParseFloat(item[5]);
                const close = safeParseFloat(item[6]);
                const change = safeParseFloat(item[8]);
                const volume = safeParseInt(item[1]);
                return [item[0], stockNo, stockName, open, high, low, close, change, volume];
            }).filter(Boolean);
        }

        const finalResult = {
            stockName,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: 'TWSE'
        };

        try {
            await store.setJSON(cacheKey, { timestamp: Date.now(), data: finalResult });
        } catch (error) {
            if (!isQuotaError(error)) {
                console.warn(`[TWSE Range] Failed to persist month cache ${cacheKey}:`, error);
            }
        }

        return finalResult;
    })();

    inFlightTwseMonthCache.set(cacheKey, resolver);
    try {
        return await resolver;
    } finally {
        inFlightTwseMonthCache.delete(cacheKey);
    }
}

async function composeTwseRange(stockNo, startDate, endDate) {
    const store = getStore('twse_cache_store');
    const months = buildMonthKeyList(startDate, endDate);
    const merged = [];
    let stockName = stockNo;

    for (const monthKey of months) {
        const monthData = await fetchTwseMonth({ store, stockNo, monthKey });
        if (monthData.stockName) stockName = monthData.stockName;
        if (Array.isArray(monthData.aaData)) merged.push(...monthData.aaData);
    }

    return {
        stockName,
        aaData: merged,
        dataSource: 'TWSE (range)'
    };
}

async function fetchFromYahoo(stockNo, symbol) {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=20y&interval=1d`;
    const response = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
    const data = await response.json();
    if (data.chart?.error) throw new Error(`Yahoo error: ${data.chart.error.description}`);
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('Yahoo response missing result payload');

    const quotes = result.indicators?.quote?.[0];
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose;
    if (!quotes || !Array.isArray(adjclose)) throw new Error('Yahoo response missing indicators');

    const formatted = result.timestamp.map((ts, index) => {
        const adjClose = adjclose[index];
        const open = quotes.open?.[index];
        const high = quotes.high?.[index];
        const low = quotes.low?.[index];
        const close = quotes.close?.[index];
        const volume = quotes.volume?.[index];
        if (adjClose === null || adjClose === undefined || open === null || open === undefined) return null;
        const date = new Date(ts * 1000);
        const rocYear = date.getFullYear() - 1911;
        const formattedDate = `${rocYear}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        const baseClose = close === null || close === undefined ? open : close;
        const scale = baseClose ? adjClose / baseClose : 1;
        const prevAdjClose = index === 0 ? adjClose : adjclose[index - 1];
        return [
            formattedDate,
            stockNo,
            '',
            open * scale,
            (high === null || high === undefined) ? open * scale : high * scale,
            (low === null || low === undefined) ? open * scale : low * scale,
            adjClose,
            adjClose - prevAdjClose,
            volume ?? 0
        ];
    }).filter(Boolean);

    return {
        stockName: result.meta?.shortName || stockNo,
        iTotalRecords: formatted.length,
        aaData: formatted,
        dataSource: 'Yahoo Finance'
    };
}

async function fetchFromFinMind(stockNo) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) throw new Error('FinMind token not configured');
    const finmindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPriceAdj&data_id=${stockNo}&token=${token}`;
    const response = await fetch(finmindUrl);
    if (!response.ok) throw new Error(`FinMind HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== 200) throw new Error(`FinMind error: ${data.msg}`);

    const formatted = data.data.map(entry => {
        const date = new Date(entry.date);
        const rocYear = date.getFullYear() - 1911;
        const formattedDate = `${rocYear}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        return [
            formattedDate,
            entry.stock_id,
            '',
            entry.open,
            entry.max,
            entry.min,
            entry.close,
            entry.spread,
            entry.Trading_Volume
        ];
    });

    return {
        stockName: stockNo,
        iTotalRecords: formatted.length,
        aaData: formatted,
        dataSource: 'FinMind'
    };
}

async function composeTpexRange(stockNo) {
    const symbol = `${stockNo}.TWO`;
    const store = getStore('tpex_cache_store');

    try {
        const cached = await store.get(symbol, { type: 'json' });
        if (cached && cached.data && (Date.now() - cached.timestamp < TPEX_TTL_MS)) {
            const base = cached.data;
            return {
                stockName: base.stockName || stockNo,
                iTotalRecords: base.iTotalRecords ?? (Array.isArray(base.aaData) ? base.aaData.length : 0),
                aaData: Array.isArray(base.aaData) ? base.aaData : [],
                dataSource: `${(base.dataSource || 'TPEX').split(' ')[0]} (cache)`
            };
        }
    } catch (error) {
        if (!isQuotaError(error)) {
            console.warn(`[TPEX Range] Cache read miss for ${symbol}:`, error);
        }
    }

    try {
        const yahooData = await fetchFromYahoo(stockNo, symbol);
        try { await store.setJSON(symbol, { timestamp: Date.now(), data: yahooData }); } catch (error) {
            if (!isQuotaError(error)) console.warn('[TPEX Range] Failed to persist Yahoo cache:', error);
        }
        return yahooData;
    } catch (yahooError) {
        console.warn('[TPEX Range] Yahoo fetch failed, fallback to FinMind:', yahooError.message);
        const finmindData = await fetchFromFinMind(stockNo);
        try { await store.setJSON(symbol, { timestamp: Date.now(), data: finmindData }); } catch (error) {
            if (!isQuotaError(error)) console.warn('[TPEX Range] Failed to persist FinMind cache:', error);
        }
        return finmindData;
    }
}

function filterAaDataByRange(aaData, startDate, endDate) {
    if (!Array.isArray(aaData)) return [];
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return aaData.filter(item => {
        const iso = formatRocDateToIso(item?.[0]);
        if (!iso) return false;
        const time = new Date(iso).getTime();
        if (Number.isNaN(time)) return false;
        return time >= startMs && time <= endMs;
    });
}

export default async (req) => {
    try {
        const params = new URL(req.url).searchParams;
        const stockNo = params.get('stockNo');
        const startDateStr = params.get('startDate');
        const endDateStr = params.get('endDate');
        const marketType = normalizeMarketType(params.get('marketType') || params.get('market'));

        if (!stockNo || !startDateStr || !endDateStr) {
            return new Response(JSON.stringify({ error: 'Missing required parameters stockNo/startDate/endDate' }), { status: 400 });
        }

        const startDate = parseISODate(startDateStr);
        const endDate = parseISODate(endDateStr);
        if (!startDate || !endDate || startDate > endDate) {
            return new Response(JSON.stringify({ error: 'Invalid date range' }), { status: 400 });
        }

        const rangeStore = getStore('stock_range_cache_store');
        const rangeKey = `${marketType}_${stockNo}_${startDateStr}_${endDateStr}`;

        try {
            const cachedRange = await rangeStore.get(rangeKey, { type: 'json' });
            if (cachedRange && cachedRange.data && (Date.now() - cachedRange.timestamp < RANGE_TTL_MS)) {
                const base = cachedRange.data;
                const payload = {
                    stockNo: base.stockNo || stockNo,
                    stockName: base.stockName || stockNo,
                    iTotalRecords: base.iTotalRecords ?? (Array.isArray(base.aaData) ? base.aaData.length : 0),
                    aaData: Array.isArray(base.aaData) ? base.aaData : [],
                    dataSource: `${base.dataSource || marketType} (cache)`,
                    marketType: base.marketType || marketType,
                    cacheStatus: 'range-cache-hit',
                    cacheKey: rangeKey,
                    cacheTimestamp: cachedRange.timestamp
                };
                return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
            }
        } catch (error) {
            if (!isQuotaError(error)) {
                console.warn('[Range Endpoint] Range cache lookup failed:', error);
            }
        }

        let merged;
        if (marketType === 'TPEX') {
            merged = await composeTpexRange(stockNo);
        } else {
            merged = await composeTwseRange(stockNo, startDate, endDate);
        }

        const filteredAaData = filterAaDataByRange(merged.aaData, startDate, endDate);
        const now = Date.now();
        const responsePayload = {
            stockNo,
            stockName: merged.stockName || stockNo,
            iTotalRecords: filteredAaData.length,
            aaData: filteredAaData,
            dataSource: merged.dataSource,
            marketType,
            cacheStatus: 'range-cache-miss',
            cacheKey: rangeKey,
            cacheTimestamp: now
        };

        try {
            await rangeStore.setJSON(rangeKey, { timestamp: now, data: responsePayload });
        } catch (error) {
            if (!isQuotaError(error)) {
                console.warn('[Range Endpoint] Failed to persist range cache:', error);
            }
        }

        return new Response(JSON.stringify(responsePayload), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Range Endpoint] Unexpected error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), { status: 500 });
    }
};
