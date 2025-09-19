// netlify/functions/twse-proxy.js (v10.0 - Range-aware tiered cache for TWSE)
// Patch Tag: LB-PRICE-MODE-20240513A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TWSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時
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

function isoToRoc(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return null;
    const rocYear = date.getFullYear() - 1911;
    return `${rocYear}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function buildMonthCacheKey(stockNo, monthKey, adjusted) {
    return `${stockNo}_${monthKey}${adjusted ? '_ADJ' : ''}`;
}

function safeRound(value) {
    return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

async function fetchYahooDaily(stockNo) {
    const symbol = `${stockNo}.TW`;
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

    const quote = result.indicators?.quote?.[0] || {};
    const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
    const rows = [];
    for (let i = 0; i < result.timestamp.length; i++) {
        const ts = result.timestamp[i];
        if (!Number.isFinite(ts)) continue;
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) continue;
        const isoDate = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        const open = Number(quote.open?.[i]);
        const high = Number(quote.high?.[i]);
        const low = Number(quote.low?.[i]);
        const close = Number(quote.close?.[i]);
        const volume = Number(quote.volume?.[i]) || 0;
        const adjClose = Number(adj?.[i]);
        rows.push({ isoDate, open, high, low, close, adjClose, volume });
    }

    return {
        stockName: result.meta?.shortName || stockNo,
        rows,
    };
}

async function persistYahooEntries(store, stockNo, yahooData, adjusted) {
    const { stockName, rows } = yahooData;
    const monthlyBuckets = new Map();
    let prevRawClose = null;
    let prevAdjClose = null;
    for (const row of rows) {
        const rocDate = isoToRoc(row.isoDate);
        if (!rocDate) continue;
        const baseClose = Number.isFinite(row.close) ? row.close : Number.isFinite(row.adjClose) ? row.adjClose : Number.isFinite(row.open) ? row.open : null;
        if (!Number.isFinite(baseClose)) continue;
        const baseOpen = Number.isFinite(row.open) ? row.open : baseClose;
        const baseHigh = Number.isFinite(row.high) ? row.high : Math.max(baseOpen, baseClose);
        const baseLow = Number.isFinite(row.low) ? row.low : Math.min(baseOpen, baseClose);
        const monthKey = row.isoDate.slice(0, 7).replace('-', '');
        let finalOpen;
        let finalHigh;
        let finalLow;
        let finalClose;
        let change;

        if (adjusted) {
            const adjClose = Number.isFinite(row.adjClose) ? row.adjClose : baseClose;
            const scale = baseClose ? adjClose / baseClose : 1;
            finalClose = safeRound(adjClose);
            finalOpen = safeRound(baseOpen * scale);
            finalHigh = safeRound(baseHigh * scale);
            finalLow = safeRound(baseLow * scale);
            const prev = Number.isFinite(prevAdjClose) ? prevAdjClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevAdjClose = finalClose !== null ? finalClose : prevAdjClose;
            if (Number.isFinite(baseClose)) {
                prevRawClose = safeRound(baseClose);
            }
        } else {
            const rawClose = Number.isFinite(baseClose) ? baseClose : Number.isFinite(row.adjClose) ? row.adjClose : baseOpen;
            finalClose = safeRound(rawClose);
            finalOpen = safeRound(baseOpen);
            finalHigh = safeRound(baseHigh);
            finalLow = safeRound(baseLow);
            const prev = Number.isFinite(prevRawClose) ? prevRawClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevRawClose = finalClose !== null ? finalClose : prevRawClose;
            if (Number.isFinite(row.adjClose)) {
                prevAdjClose = safeRound(row.adjClose);
            }
        }

        if (finalOpen === null || finalHigh === null || finalLow === null || finalClose === null) {
            continue;
        }

        const vol = Number.isFinite(row.volume) ? Math.round(row.volume) : 0;
        const aaRow = [rocDate, stockNo, stockName, finalOpen, finalHigh, finalLow, finalClose, change || 0, vol];
        if (!monthlyBuckets.has(monthKey)) monthlyBuckets.set(monthKey, []);
        monthlyBuckets.get(monthKey).push(aaRow);
    }

    const dataSource = adjusted ? 'Yahoo Finance (還原)' : 'Yahoo Finance (原始)';
    for (const [monthKey, rowsOfMonth] of monthlyBuckets.entries()) {
        rowsOfMonth.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        const payload = { stockName, aaData: rowsOfMonth, dataSource };
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, adjusted), payload);
    }

    return dataSource;
}

async function readCache(store, cacheKey) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() - memoryHit.timestamp < TWSE_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }

    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < TWSE_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn(`[TWSE Proxy v10.0] Blobs 流量受限，改用記憶體快取。`);
        } else {
            console.error('[TWSE Proxy v10.0] 讀取 Blobs 時發生錯誤:', error);
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
            console.warn('[TWSE Proxy v10.0] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[TWSE Proxy v10.0] 寫入 Blobs 失敗:', error);
        }
    }
}

function parseTWSEPayload(raw, stockNo) {
    if (!raw || raw.stat !== 'OK' || !Array.isArray(raw.data)) {
        return { stockName: stockNo, aaData: [] };
    }
    const stockName = raw.title?.split(' ')?.[2] || stockNo;
    const aaData = raw.data.map(item => {
        const open = Number(String(item[3]).replace(/,/g, ''));
        const high = Number(String(item[4]).replace(/,/g, ''));
        const low = Number(String(item[5]).replace(/,/g, ''));
        const close = Number(String(item[6]).replace(/,/g, ''));
        const change = Number(String(item[8]).replace(/,/g, ''));
        const volume = Number(String(item[1]).replace(/,/g, ''));
        return [
            item[0],
            stockNo,
            stockName,
            Number.isFinite(open) ? open : null,
            Number.isFinite(high) ? high : null,
            Number.isFinite(low) ? low : null,
            Number.isFinite(close) ? close : null,
            Number.isFinite(change) ? change : null,
            Number.isFinite(volume) ? volume : 0
        ];
    });
    return { stockName, aaData };
}

function selectDataSourceLabel(sources) {
    if (sources.size === 0) return 'TWSE';
    const labels = Array.from(sources);
    const primaryYahoo = labels.find(label => /Yahoo Finance/i.test(label));
    const primaryTwse = labels.find(label => /^TWSE/i.test(label));
    const hasCache = labels.some(label => /memory|blob|快取/i.test(label));
    const hasRemote = labels.includes('remote');
    const primary = primaryYahoo || primaryTwse || (hasRemote ? 'TWSE' : labels.find(label => !/memory|blob/.test(label)) || 'TWSE');
    if (primaryYahoo) {
        return hasCache ? `${primary} (快取)` : primary;
    }
    if (hasRemote && hasCache) return `${primary} (部分快取)`;
    if (hasCache) return `${primary} (快取)`;
    if (hasRemote) return `${primary} (遠端)`;
    return primary;
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
            return new Response(JSON.stringify({ stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: 'TWSE' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const store = getStore('twse_cache_store');
        const combinedRows = [];
        const sourceFlags = new Set();
        let stockName = '';
        let yahooHydrated = false;
        let yahooSourceLabel = '';

        for (const month of months) {
            const cacheKey = buildMonthCacheKey(stockNo, month, adjusted);
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = await readCache(store, cacheKey);
            if (!payload) {
                if (adjusted) {
                    if (!yahooHydrated) {
                        try {
                            const yahooData = await fetchYahooDaily(stockNo);
                            yahooSourceLabel = await persistYahooEntries(store, stockNo, yahooData, true);
                        } catch (error) {
                            console.error('[TWSE Proxy v10.0] Yahoo 抓取失敗:', error);
                            yahooSourceLabel = 'Yahoo Finance (還原)';
                        }
                        yahooHydrated = true;
                    }
                    payload = await readCache(store, cacheKey);
                    if (payload && yahooSourceLabel) {
                        sourceFlags.add(yahooSourceLabel);
                    }
                } else {
                    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month}01&stockNo=${stockNo}`;
                    console.log(`[TWSE Proxy v10.0] 下載 ${stockNo} 的 ${month} 月資料`);
                    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    if (!response.ok) {
                        console.warn(`[TWSE Proxy v10.0] TWSE 回應 ${response.status}，略過 ${month}`);
                        sourceFlags.add('remote');
                        continue;
                    }
                    const parsed = parseTWSEPayload(await response.json(), stockNo);
                    payload = { ...parsed, dataSource: 'TWSE' };
                    await writeCache(store, cacheKey, payload);
                    sourceFlags.add('remote');
                }
            } else {
                sourceFlags.add(payload.source === 'blob' ? 'blob' : 'memory');
            }

            if (!payload) continue;

            if (!stockName && payload.stockName) {
                stockName = payload.stockName;
            }

            if (payload?.dataSource) {
                sourceFlags.add(payload.dataSource);
            }

            const monthRows = Array.isArray(payload.aaData) ? payload.aaData : [];
            monthRows.forEach(row => {
                if (withinRange(row[0], rangeStart, rangeEnd)) {
                    combinedRows.push(row.slice());
                }
            });
        }

        combinedRows.sort((a, b) => {
            const da = rocToISO(a[0]);
            const db = rocToISO(b[0]);
            return new Date(da) - new Date(db);
        });

        const uniqueMap = new Map();
        combinedRows.forEach(row => {
            uniqueMap.set(row[0], row);
        });

        const aaData = Array.from(uniqueMap.values());
        const body = {
            stockName: stockName || stockNo,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: selectDataSourceLabel(sourceFlags)
        };

        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[TWSE Proxy v10.0] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'TWSE Proxy error' }), { status: 500 });
    }
};
