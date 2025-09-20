// netlify/functions/twse-proxy.js (v10.0 - Range-aware tiered cache for TWSE)
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
    if (sources.size === 1) {
        const [label] = sources;
        if (label === 'memory') return 'TWSE (記憶體快取)';
        if (label === 'blob') return 'TWSE (快取)';
        return label;
    }
    const hasFresh = sources.has('remote');
    const hasCache = sources.has('memory') || sources.has('blob');
    if (hasFresh && hasCache) return 'TWSE (部分快取)';
    if (hasCache) return 'TWSE (快取)';
    return 'TWSE';
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
            return new Response(JSON.stringify({ stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: 'TWSE' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const store = getStore('twse_cache_store');
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
                const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month}01&stockNo=${stockNo}`;
                console.log(`[TWSE Proxy v10.0] 下載 ${stockNo} 的 ${month} 月資料`);
                const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!response.ok) {
                    console.warn(`[TWSE Proxy v10.0] TWSE 回應 ${response.status}，略過 ${month}`);
                    sourceFlags.add('remote');
                    continue;
                }
                const parsed = parseTWSEPayload(await response.json(), stockNo);
                payload = { ...parsed };
                await writeCache(store, cacheKey, payload);
                sourceFlags.add('remote');
            } else {
                sourceFlags.add(payload.source === 'blob' ? 'blob' : 'memory');
            }

            if (!stockName && payload.stockName) {
                stockName = payload.stockName;
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
