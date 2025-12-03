// netlify/functions/stock-range.js (v3.0 - yearly blob cache)
// Patch Tag: LB-CACHE-TIER-20250720A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TWSE_MONTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TPEX_PRIMARY_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const YEAR_CACHE_TWSE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const YEAR_CACHE_TPEX_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

const inFlightTwseMonthCache = new Map();

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
            if (cached && cached.data && (Date.now() - cached.timestamp < TWSE_MONTH_TTL_MS)) {
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
        dataSource: 'TWSE (range)',
        monthCount: months.length,
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
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    if (!quotes || !Array.isArray(quotes.close) || timestamps.length !== quotes.close.length) {
        throw new Error('Yahoo response missing quote payload');
    }

    const rows = [];
    for (let i = 0; i < timestamps.length; i += 1) {
        const date = new Date(timestamps[i] * 1000);
        if (Number.isNaN(date.getTime())) continue;
        const rocYear = date.getFullYear() - 1911;
        const formattedDate = `${rocYear}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        const open = quotes.open?.[i] ?? null;
        const high = quotes.high?.[i] ?? null;
        const low = quotes.low?.[i] ?? null;
        const close = quotes.close?.[i] ?? null;
        const volume = quotes.volume?.[i] ?? null;
        const spread = adjclose && Array.isArray(adjclose) ? adjclose[i] : null;
        rows.push([formattedDate, stockNo, '', open, high, low, close, spread, volume]);
    }

    return {
        stockName: stockNo,
        aaData: rows,
        dataSource: 'Yahoo Finance',
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
        if (cached && cached.data && (Date.now() - cached.timestamp < TPEX_PRIMARY_TTL_MS)) {
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

function buildYearList(startDate, endDate) {
    const years = [];
    let cursor = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();
    while (cursor <= endYear) {
        years.push(cursor);
        cursor += 1;
    }
    return years;
}

function getYearCacheKey(marketType, stockNo, year) {
    return `${marketType}_${stockNo}_${year}`;
}

function getYearCacheTtl(marketType) {
    return marketType === 'TPEX' ? YEAR_CACHE_TPEX_MS : YEAR_CACHE_TWSE_MS;
}

function groupAaDataByYear(aaData) {
    const groups = new Map();
    if (!Array.isArray(aaData)) return groups;
    aaData.forEach((row) => {
        const iso = formatRocDateToIso(row?.[0]);
        if (!iso) return;
        const year = parseInt(iso.slice(0, 4), 10);
        if (!Number.isFinite(year)) return;
        if (!groups.has(year)) groups.set(year, []);
        groups.get(year).push(row);
    });
    return groups;
}

async function persistYearSlice(store, cacheKey, payload, telemetry) {
    if (!store || !payload) return;
    try {
        await store.setJSON(cacheKey, { timestamp: Date.now(), data: payload });
        if (telemetry) telemetry.writeOps += 1;
    } catch (error) {
        if (!isQuotaError(error)) {
            console.warn('[Year Cache] Failed to persist', cacheKey, error);
        }
    }
}

async function fetchYearDataset({ store, stockNo, marketType, year, telemetry }) {
    const yearKey = getYearCacheKey(marketType, stockNo, year);
    telemetry.yearKeys.push(yearKey);
    let cached = null;
    if (store) {
        try {
            telemetry.readOps += 1;
            cached = await store.get(yearKey, { type: 'json' });
            if (cached && cached.data && (Date.now() - cached.timestamp < getYearCacheTtl(marketType))) {
                telemetry.cacheHits += 1;
                telemetry.hitYearKeys.push(yearKey);
                const base = cached.data;
                return {
                    stockName: base.stockName || stockNo,
                    aaData: Array.isArray(base.aaData) ? base.aaData : [],
                    dataSource: `${marketType} (cache)`
                };
            }
        } catch (error) {
            if (!isQuotaError(error)) {
                console.warn('[Year Cache] Read failed', yearKey, error);
            }
        }
    }

    telemetry.cacheMisses += 1;
    telemetry.missYearKeys.push(yearKey);
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31));

    if (marketType === 'TPEX') {
        const tpexData = await composeTpexRange(stockNo);
        const groups = groupAaDataByYear(tpexData.aaData);
        if (store) {
            for (const [yr, rows] of groups.entries()) {
                const cachePayload = {
                    stockName: tpexData.stockName || stockNo,
                    aaData: rows,
                    marketType,
                };
                await persistYearSlice(store, getYearCacheKey(marketType, stockNo, yr), cachePayload, telemetry);
                if (yr !== year) {
                    telemetry.primedYearKeys.push(getYearCacheKey(marketType, stockNo, yr));
                }
            }
        }
        const aaData = groups.get(year) || [];
        return {
            stockName: tpexData.stockName || stockNo,
            aaData,
            dataSource: tpexData.dataSource || 'TPEX',
        };
    }

    const twseData = await composeTwseRange(stockNo, startDate, endDate);
    if (store) {
        const cachePayload = {
            stockName: twseData.stockName || stockNo,
            aaData: twseData.aaData,
            marketType,
        };
        await persistYearSlice(store, yearKey, cachePayload, telemetry);
    }
    return {
        stockName: twseData.stockName || stockNo,
        aaData: twseData.aaData,
        dataSource: twseData.dataSource,
    };
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

        const years = buildYearList(startDate, endDate);
        const yearStore = getStore('stock_year_cache_store');
        const telemetry = {
            provider: 'year-cache',
            market: marketType,
            yearKeys: [],
            cacheHits: 0,
            cacheMisses: 0,
            readOps: 0,
            writeOps: 0,
            years,
            hitYearKeys: [],
            missYearKeys: [],
            primedYearKeys: [],
        };

        const yearResults = [];
        let resolvedStockName = stockNo;
        for (const year of years) {
            const result = await fetchYearDataset({
                store: yearStore,
                stockNo,
                marketType,
                year,
                telemetry,
            });
            if (result.stockName) resolvedStockName = result.stockName;
            if (Array.isArray(result.aaData)) {
                yearResults.push(result.aaData);
            }
        }

        const mergedAaData = yearResults.flat();
        const filteredAaData = filterAaDataByRange(mergedAaData, startDate, endDate);
        telemetry.returnedRows = filteredAaData.length;

        const responsePayload = {
            stockNo,
            stockName: resolvedStockName,
            iTotalRecords: filteredAaData.length,
            aaData: filteredAaData,
            dataSource: mergedAaData.length > 0 ? 'Blob Year Cache' : marketType,
            marketType,
            meta: {
                years,
                cacheHits: telemetry.cacheHits,
                cacheMisses: telemetry.cacheMisses,
                readOps: telemetry.readOps,
                writeOps: telemetry.writeOps,
                yearKeys: telemetry.yearKeys,
                hitYearKeys: telemetry.hitYearKeys,
                missYearKeys: telemetry.missYearKeys,
                primedYearKeys: telemetry.primedYearKeys,
                source: 'year-cache',
            }
        };

        // [Dynamic Caching Strategy]
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isHistorical = endDate < today;
        const cacheTTL = isHistorical ? 31536000 : 3600;
        const cacheControlHeader = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}${isHistorical ? ', immutable' : ''}`;

        return new Response(JSON.stringify(responsePayload), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': cacheControlHeader,
                'Netlify-CDN-Cache-Control': `public, s-maxage=${cacheTTL}`,
            }
        });
    } catch (error) {
        console.error('[Year Range] Unexpected error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal error' }), { status: 500 });
    }
};
