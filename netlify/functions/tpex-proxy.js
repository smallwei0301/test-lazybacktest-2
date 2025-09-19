// netlify/functions/tpex-proxy.js (v10.0 - Range-aware tiered cache for TPEX)
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
            console.warn('[TPEX Proxy v10.0] Blobs 流量受限，改用記憶體快取。');
        } else {
            console.error('[TPEX Proxy v10.0] 讀取 Blobs 時發生錯誤:', error);
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
            console.warn('[TPEX Proxy v10.0] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[TPEX Proxy v10.0] 寫入 Blobs 失敗:', error);
        }
    }
}

async function fetchFromYahoo(stockNo) {
    const symbol = `${stockNo}.TWO`;
    console.log(`[TPEX Proxy v10.0] 嘗試 Yahoo Finance: ${symbol}`);
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

    for (let i = 0; i < result.timestamp.length; i++) {
        const ts = result.timestamp[i];
        const close = adjclose[i];
        if (close == null) continue;
        const open = quotes.open?.[i] ?? close;
        const high = quotes.high?.[i] ?? Math.max(open, close);
        const low = quotes.low?.[i] ?? Math.min(open, close);
        const rawClose = quotes.close?.[i] ?? close;
        const volume = quotes.volume?.[i] ?? 0;
        const prevClose = i > 0 && adjclose[i - 1] != null ? adjclose[i - 1] : null;

        const adjFactor = rawClose ? close / rawClose : 1;
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) continue;
        const isoDate = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;

        const adjOpen = Number((open * adjFactor).toFixed(4));
        const adjHigh = Number((high * adjFactor).toFixed(4));
        const adjLow = Number((low * adjFactor).toFixed(4));
        const adjClose = Number(close.toFixed(4));
        const change = prevClose != null ? Number((close - prevClose).toFixed(4)) : 0;
        const vol = Number(volume) || 0;

        entries.push({
            isoDate,
            aaRow: [rocDate, stockNo, stockName, adjOpen, adjHigh, adjLow, adjClose, change, vol]
        });
    }

    return { stockName, entries, dataSource: 'Yahoo Finance' };
}

async function fetchFromFinMind(stockNo) {
    console.warn('[TPEX Proxy v10.0] Yahoo 失敗，改用 FinMind 備援來源');
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPriceAdj&data_id=${stockNo}&token=${token}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`FinMind HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.status !== 200) {
        throw new Error(`FinMind 回應錯誤: ${json.msg}`);
    }

    const entries = [];
    for (const item of json.data || []) {
        const isoDate = item.date;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        const open = Number(item.open) || Number(item.Open) || Number(item.Opening) || 0;
        const high = Number(item.max) || Number(item.high) || 0;
        const low = Number(item.min) || Number(item.low) || 0;
        const close = Number(item.close) || Number(item.Close) || 0;
        const spread = Number(item.spread ?? item.change ?? 0) || 0;
        const volume = Number(item.Trading_Volume ?? item.volume ?? 0) || 0;

        entries.push({
            isoDate,
            aaRow: [rocDate, stockNo, stockNo, open, high, low, close, spread, volume]
        });
    }
    return { stockName: stockNo, entries, dataSource: 'FinMind (備援)' };
}

async function persistEntries(store, stockNo, entries, stockName, dataSource) {
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
        await writeCache(store, `${stockNo}_${monthKey}`, payload);
    }
    return buckets;
}

async function hydrateMissingMonths(store, stockNo) {
    try {
        const yahooResult = await fetchFromYahoo(stockNo);
        await persistEntries(store, stockNo, yahooResult.entries, yahooResult.stockName, yahooResult.dataSource);
        return yahooResult.dataSource;
    } catch (yahooError) {
        console.warn('[TPEX Proxy v10.0] Yahoo 來源失敗:', yahooError.message);
        const finmindResult = await fetchFromFinMind(stockNo);
        await persistEntries(store, stockNo, finmindResult.entries, finmindResult.stockName, finmindResult.dataSource);
        return finmindResult.dataSource;
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
            const cacheKey = `${stockNo}_${month}`;
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = await readCache(store, cacheKey);
            if (!payload) {
                const sourceLabel = await hydrateMissingMonths(store, stockNo);
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
        console.error('[TPEX Proxy v10.0] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'TPEX Proxy error' }), { status: 500 });
    }
};
