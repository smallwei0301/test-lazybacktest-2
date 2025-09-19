// netlify/functions/tpex-proxy.js (v10.1 - FinMind primary for raw, Yahoo fallback; Yahoo primary for adjusted)
// Patch Tag: LB-PRICE-MODE-20240516A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TPEX_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時
const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>

function isQuotaError(error) {
    return error?.status === 402 || error?.status === 429;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function buildMonthCacheKey(stockNo, monthKey, adjusted) {
    return `${stockNo}_${monthKey}${adjusted ? '_ADJ' : ''}`;
}

function parseDate(value) {
    if (!value) return null;
    const isoCandidate = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoCandidate)) {
        const iso = new Date(isoCandidate);
        return Number.isNaN(iso.getTime()) ? null : iso;
    }
    if (/^\d{6}$/.test(isoCandidate)) {
        const year = Number(isoCandidate.slice(0, 4));
        const month = Number(isoCandidate.slice(4)) - 1;
        const date = new Date(year, month, 1);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{8}$/.test(isoCandidate)) {
        const year = Number(isoCandidate.slice(0, 4));
        const month = Number(isoCandidate.slice(4, 6)) - 1;
        const day = Number(isoCandidate.slice(6));
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(isoCandidate)) {
        const [rocYear, month, day] = isoCandidate.split('/').map(Number);
        const date = new Date(rocYear + 1911, month - 1, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function ensureMonthList(startDate, endDate) {
    const months = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= last) {
        months.push(`${cursor.getFullYear()}${pad2(cursor.getMonth() + 1)}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}

function isoToRoc(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return null;
    const rocYear = date.getFullYear() - 1911;
    return `${rocYear}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function rocToISO(rocDate) {
    if (!rocDate) return null;
    const parts = String(rocDate).trim().split('/');
    if (parts.length !== 3) return null;
    const [rocYear, month, day] = parts.map(Number);
    if (!rocYear || !month || !day) return null;
    const year = rocYear + 1911;
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function withinRange(rocDate, start, end) {
    const iso = rocToISO(rocDate);
    if (!iso) return false;
    const d = new Date(iso);
    return !(Number.isNaN(d.getTime()) || d < start || d > end);
}

async function readCache(store, cacheKey) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() - memoryHit.timestamp < TPEX_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }

    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < TPEX_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn('[TPEX Proxy v10.1] Blobs 流量受限，改用記憶體快取。');
        } else {
            console.error('[TPEX Proxy v10.1] 讀取 Blobs 時發生錯誤:', error);
        }
    }
    return null;
}

async function writeCache(store, cacheKey, payload) {
    inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    try {
        await store.setJSON(cacheKey, { timestamp: Date.now(), data: payload });
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn('[TPEX Proxy v10.1] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[TPEX Proxy v10.1] 寫入 Blobs 失敗:', error);
        }
    }
}

async function fetchFromYahoo(stockNo, adjusted) {
    const symbol = `${stockNo}.TWO`;
    console.log(`[TPEX Proxy v10.1] 嘗試 Yahoo Finance: ${symbol}`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=20y&interval=1d`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        throw new Error(`Yahoo HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json?.chart?.error) {
        throw new Error(`Yahoo 回應錯誤: ${json.chart.error.description}`);
    }
    const result = json?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
        throw new Error('Yahoo 回傳資料格式異常');
    }

    const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
    const quotes = result?.indicators?.quote?.[0] || {};
    const stockName = result?.meta?.shortName || symbol;
    const entries = [];
    let prevRawClose = null;
    let prevAdjClose = null;

    for (let i = 0; i < result.timestamp.length; i++) {
        const ts = result.timestamp[i];
        const rawCloseValue = quotes.close?.[i];
        const adjCloseValue = adjclose[i];
        const volume = Number(quotes.volume?.[i]) || 0;
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) continue;
        const isoDate = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        const openRaw = Number(quotes.open?.[i]);
        const highRaw = Number(quotes.high?.[i]);
        const lowRaw = Number(quotes.low?.[i]);
        const baseClose = Number.isFinite(rawCloseValue) ? rawCloseValue : Number.isFinite(adjCloseValue) ? adjCloseValue : Number.isFinite(openRaw) ? openRaw : null;
        if (!Number.isFinite(baseClose)) continue;
        const baseOpen = Number.isFinite(openRaw) ? openRaw : baseClose;
        const baseHigh = Number.isFinite(highRaw) ? highRaw : Math.max(baseOpen, baseClose);
        const baseLow = Number.isFinite(lowRaw) ? lowRaw : Math.min(baseOpen, baseClose);

        let finalOpen;
        let finalHigh;
        let finalLow;
        let finalClose;
        let change;

        if (adjusted) {
            const adjClose = Number.isFinite(adjCloseValue) ? adjCloseValue : baseClose;
            const scale = baseClose ? adjClose / baseClose : 1;
            finalClose = Number(adjClose.toFixed(4));
            finalOpen = Number((baseOpen * scale).toFixed(4));
            finalHigh = Number((baseHigh * scale).toFixed(4));
            finalLow = Number((baseLow * scale).toFixed(4));
            const prev = Number.isFinite(prevAdjClose) ? prevAdjClose : null;
            change = prev !== null ? Number((finalClose - prev).toFixed(4)) : 0;
            prevAdjClose = finalClose;
            if (Number.isFinite(baseClose)) {
                prevRawClose = Number(baseClose.toFixed(4));
            }
        } else {
            const rawClose = Number.isFinite(baseClose) ? baseClose : Number.isFinite(adjCloseValue) ? adjCloseValue : baseOpen;
            finalClose = Number(rawClose.toFixed(4));
            finalOpen = Number(baseOpen.toFixed(4));
            finalHigh = Number(baseHigh.toFixed(4));
            finalLow = Number(baseLow.toFixed(4));
            const prev = Number.isFinite(prevRawClose) ? prevRawClose : null;
            change = prev !== null ? Number((finalClose - prev).toFixed(4)) : 0;
            prevRawClose = finalClose;
            if (Number.isFinite(adjCloseValue)) {
                prevAdjClose = Number(adjCloseValue.toFixed(4));
            }
        }

        entries.push({
            isoDate,
            aaRow: [rocDate, stockNo, stockName, finalOpen, finalHigh, finalLow, finalClose, change || 0, volume]
        });
    }

    const dataSource = adjusted ? 'Yahoo Finance (還原)' : 'Yahoo Finance (原始)';
    return { stockName, entries, dataSource };
}

async function fetchFromFinMind(stockNo, adjusted) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const dataset = adjusted ? 'TaiwanStockPriceAdj' : 'TaiwanStockPrice';
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${stockNo}&token=${token}`;
    console.log(`[TPEX Proxy v10.1] 呼叫 FinMind: ${dataset} ${stockNo}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`FinMind HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.status !== 200) {
        throw new Error(`FinMind 回應錯誤: ${json.msg}`);
    }

    const entries = [];
    let stockName = '';
    for (const item of json.data || []) {
        const isoDate = item.date;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        if (!stockName && item.stock_name) {
            stockName = item.stock_name;
        }
        const open = Number(item.open) || Number(item.Open) || Number(item.Opening) || 0;
        const high = Number(item.max) || Number(item.high) || 0;
        const low = Number(item.min) || Number(item.low) || 0;
        const closeValue = Number(item.close) || Number(item.Close) || 0;
        const spread = Number(item.spread ?? item.change ?? 0) || 0;
        const volume = Number(item.Trading_Volume ?? item.volume ?? 0) || 0;

        entries.push({
            isoDate,
            aaRow: [rocDate, stockNo, stockNo, open, high, low, closeValue, spread, volume]
        });
    }
    const dataSource = adjusted ? 'FinMind (還原備援)' : 'FinMind (原始)';
    return { stockName: stockName || stockNo, entries, dataSource };
}

async function persistEntries(store, stockNo, entries, stockName, dataSource, adjusted) {
    const buckets = new Map(); // Map<monthKey, aaData[]>
    for (const entry of entries) {
        const monthKey = entry.isoDate.slice(0, 7).replace('-', '');
        if (!buckets.has(monthKey)) buckets.set(monthKey, []);
        const row = entry.aaRow.slice();
        row[2] = stockName;
        buckets.get(monthKey).push(row);
    }

    for (const [monthKey, rows] of buckets.entries()) {
        rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        const payload = { stockName, aaData: rows, dataSource };
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, adjusted), payload);
    }
    return buckets;
}

async function hydrateMissingMonths(store, stockNo, adjusted) {
    if (adjusted) {
        try {
            const yahooResult = await fetchFromYahoo(stockNo, true);
            await persistEntries(store, stockNo, yahooResult.entries, yahooResult.stockName, yahooResult.dataSource, true);
            return yahooResult.dataSource;
        } catch (yahooError) {
            console.warn('[TPEX Proxy v10.1] Yahoo 還原來源失敗:', yahooError.message);
            const finmindResult = await fetchFromFinMind(stockNo, true);
            await persistEntries(store, stockNo, finmindResult.entries, finmindResult.stockName, finmindResult.dataSource, true);
            return finmindResult.dataSource;
        }
    }

    try {
        const finmindResult = await fetchFromFinMind(stockNo, false);
        await persistEntries(store, stockNo, finmindResult.entries, finmindResult.stockName, finmindResult.dataSource, false);
        return finmindResult.dataSource;
    } catch (finmindError) {
        console.warn('[TPEX Proxy v10.1] FinMind 原始來源失敗:', finmindError.message);
        const yahooResult = await fetchFromYahoo(stockNo, false);
        const fallbackLabel = 'Yahoo Finance (原始備援)';
        await persistEntries(store, stockNo, yahooResult.entries, yahooResult.stockName, fallbackLabel, false);
        return fallbackLabel;
    }
}

function summariseSources(flags) {
    if (flags.size === 0) return 'TPEX';
    if (flags.size === 1) return Array.from(flags)[0];
    const hasRemote = Array.from(flags).some(src => /Yahoo|FinMind/i.test(src));
    const hasCache = Array.from(flags).some(src => /快取|cache|記憶體/i.test(src));
    if (hasRemote && hasCache) return 'TPEX (部分快取)';
    if (hasCache && !hasRemote) return 'TPEX (快取)';
    return Array.from(flags).join(' / ');
}

export default async (req) => {
    try {
        const params = new URL(req.url).searchParams;
        const stockNo = params.get('stockNo');
        if (!stockNo) {
            return new Response(JSON.stringify({ error: '缺少股票代號' }), { status: 400 });
        }

        const monthParam = params.get('month');
        const startParam = params.get('start');
        const endParam = params.get('end');
        const legacyDate = params.get('date');
        const adjusted = params.get('adjusted') === '1' || params.get('adjusted') === 'true';

        let startDate = parseDate(startParam);
        let endDate = parseDate(endParam);
        if (!startDate || !endDate) {
            const monthSeed = parseDate(monthParam || legacyDate);
            if (!monthSeed) {
                return new Response(JSON.stringify({ error: '缺少日期範圍' }), { status: 400 });
            }
            const monthStart = new Date(monthSeed.getFullYear(), monthSeed.getMonth(), 1);
            const monthEnd = new Date(monthSeed.getFullYear(), monthSeed.getMonth() + 1, 0);
            startDate = monthStart;
            endDate = monthEnd;
        }

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
            return new Response(JSON.stringify({ error: '日期範圍無效' }), { status: 400 });
        }

        const months = ensureMonthList(startDate, endDate);
        if (months.length === 0) {
            return new Response(JSON.stringify({ stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: 'TPEX' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const store = getStore('tpex_cache_store');
        const combinedRows = [];
        const sourceFlags = new Set();
        let stockName = '';

        for (const month of months) {
            const cacheKey = buildMonthCacheKey(stockNo, month, adjusted);
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = await readCache(store, cacheKey);
            if (!payload) {
                const sourceLabel = await hydrateMissingMonths(store, stockNo, adjusted);
                payload = await readCache(store, cacheKey);
                if (payload) {
                    sourceFlags.add(sourceLabel);
                }
            } else {
                if (payload.source === 'blob') {
                    sourceFlags.add('TPEX (快取)');
                } else if (payload.source === 'memory') {
                    sourceFlags.add('TPEX (記憶體快取)');
                } else {
                    sourceFlags.add('TPEX (快取)');
                }
            }

            if (!payload) continue;
            if (!stockName && payload.stockName) {
                stockName = payload.stockName;
            }
            if (payload.dataSource && /Yahoo|FinMind/i.test(payload.dataSource)) {
                sourceFlags.add(payload.dataSource);
            }

            const rows = Array.isArray(payload.aaData) ? payload.aaData : [];
            rows.forEach(row => {
                if (withinRange(row[0], rangeStart, rangeEnd)) {
                    combinedRows.push(row.slice());
                }
            });
        }

        const uniqueMap = new Map();
        combinedRows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        combinedRows.forEach(row => {
            uniqueMap.set(row[0], row);
        });

        const aaData = Array.from(uniqueMap.values());
        const body = {
            stockName: stockName || stockNo,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: summariseSources(sourceFlags)
        };

        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[TPEX Proxy v10.1] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'TPEX Proxy error' }), { status: 500 });
    }
};
